import { or, eq, and, max, gt, count, isNull } from 'drizzle-orm';
import { person, personEntry, personExit } from './schema/person';
import { StateInside, StateOutside, type State } from '$lib/types/state';
import { fuzzySearchFilters } from './fuzzysearch';
import { sqlConcat, sqlLeast, sqlLevenshteinDistance } from './utils';
import { isInside } from '../isInside';
import { DB as db } from './connect';
import { capitalizeString, sanitizeString } from '$lib/utils/sanitize';
import { building } from './schema/building';
import type { PersonType } from '$lib/types/person';

// Gets all persons using optional filters
export async function getPersons(
	limit: number,
	offset: number,
	searchQuery?: string
): Promise<
	{
		id: number;
		identifier: string;
		type: PersonType;
		fname: string;
		lname: string;
		department: string;
		building: string | null;
		state: State;
	}[]
> {
	// Assert limit is valid
	if (limit === null || limit === undefined || limit <= 0) {
		throw new Error('Invalid limit');
	}

	// Don't search if the search query is empty when trimmed
	const sanitizedSearchQuery = searchQuery ? sanitizeString(searchQuery) : undefined;
	const nonEmptySearchQuery = sanitizedSearchQuery
		? sanitizedSearchQuery !== ''
			? sanitizedSearchQuery
			: undefined
		: undefined;

	try {
		const maxEntrySubquery = db
			.select({
				personId: personEntry.personId,
				maxEntryTimestamp: max(personEntry.timestamp).as('max_entry_timestamp')
			})
			.from(personEntry)
			.groupBy(personEntry.personId)
			.as('max_entry');

		const persons =
			nonEmptySearchQuery !== undefined
				? await db
						.select({
							id: person.id,
							identifier: person.identifier,
							type: person.type,
							fname: person.fname,
							lname: person.lname,
							department: person.department,
							entryTimestamp: maxEntrySubquery.maxEntryTimestamp,
							entryBuilding: personEntry.building,
							exitTimestamp: max(personExit.timestamp),
							leastDistance: sqlLeast([
								sqlLevenshteinDistance(sqlConcat([person.identifier]), nonEmptySearchQuery),
								sqlLevenshteinDistance(sqlConcat([person.fname]), nonEmptySearchQuery),
								sqlLevenshteinDistance(sqlConcat([person.lname]), nonEmptySearchQuery),
								sqlLevenshteinDistance(
									sqlConcat([person.fname, person.lname], ' '),
									nonEmptySearchQuery
								),
								sqlLevenshteinDistance(
									sqlConcat([person.lname, person.fname], ' '),
									nonEmptySearchQuery
								)
							]).as('least_distance'),
							leastDistanceIdentifier: sqlLevenshteinDistance(
								sqlConcat([person.identifier]),
								nonEmptySearchQuery
							).as('least_distance_identifier')
						})
						.from(person)
						.leftJoin(maxEntrySubquery, eq(maxEntrySubquery.personId, person.id))
						.leftJoin(
							personEntry,
							and(
								eq(personEntry.personId, person.id),
								eq(personEntry.timestamp, maxEntrySubquery.maxEntryTimestamp)
							)
						)
						.leftJoin(personExit, eq(person.id, personExit.personId))
						.where(
							or(
								...[
									...fuzzySearchFilters([person.identifier], nonEmptySearchQuery),
									...fuzzySearchFilters([person.fname], nonEmptySearchQuery, { distance: 5 }),
									...fuzzySearchFilters([person.lname], nonEmptySearchQuery, { distance: 5 }),
									...fuzzySearchFilters([person.fname, person.lname], nonEmptySearchQuery, {
										distance: 6
									}),
									...fuzzySearchFilters([person.lname, person.fname], nonEmptySearchQuery, {
										distance: 6
									})
								]
							)
						)
						.groupBy(
							person.id,
							person.identifier,
							person.type,
							person.fname,
							person.lname,
							person.department,
							maxEntrySubquery.maxEntryTimestamp,
							personEntry.building
						)
						.orderBy(({ leastDistance, leastDistanceIdentifier, identifier }) => [
							leastDistance,
							leastDistanceIdentifier,
							identifier
						])
						.limit(limit)
						.offset(offset)
				: await db
						.select({
							id: person.id,
							identifier: person.identifier,
							type: person.type,
							fname: person.fname,
							lname: person.lname,
							department: person.department,
							entryTimestamp: maxEntrySubquery.maxEntryTimestamp,
							entryBuilding: personEntry.building,
							exitTimestamp: max(personExit.timestamp)
						})
						.from(person)
						.leftJoin(maxEntrySubquery, eq(maxEntrySubquery.personId, person.id))
						.leftJoin(
							personEntry,
							and(
								eq(personEntry.personId, person.id),
								eq(personEntry.timestamp, maxEntrySubquery.maxEntryTimestamp)
							)
						)
						.leftJoin(personExit, eq(person.id, personExit.personId))
						.groupBy(
							person.id,
							person.identifier,
							person.type,
							person.fname,
							person.lname,
							person.department,
							maxEntrySubquery.maxEntryTimestamp,
							personEntry.building
						)
						.orderBy(({ identifier }) => [identifier])
						.limit(limit)
						.offset(offset);

		return persons.map((s) => {
			return {
				id: s.id,
				identifier: s.identifier,
				type: s.type as PersonType,
				fname: s.fname,
				lname: s.lname,
				department: s.department,
				building: isInside(s.entryTimestamp, s.exitTimestamp) ? s.entryBuilding : null,
				state: isInside(s.entryTimestamp, s.exitTimestamp) ? StateInside : StateOutside
			};
		});
	} catch (err: unknown) {
		throw new Error(`Failed to get persons from database: ${(err as Error).message}`);
	}
}

// Gets the count of all persons that are inside, per building
export async function getPersonsCountPerBuilding(): Promise<
	{
		building: string;
		insideCount: number;
	}[]
> {
	try {
		const personInsideSubquery = db
			.select({
				personId: personEntry.personId,
				entryBuilding: personEntry.building,
				maxEntryTimestamp: max(personEntry.timestamp),
				maxExitTimestamp: max(personExit.timestamp)
			})
			.from(personEntry)
			.leftJoin(personExit, eq(personEntry.personId, personExit.personId))
			.groupBy(personEntry.personId, personEntry.building)
			.having(({ maxEntryTimestamp, maxExitTimestamp }) =>
				or(isNull(maxExitTimestamp), gt(maxEntryTimestamp, maxExitTimestamp))
			)
			.as('person_inside');

		return await db
			.select({
				building: building.name,
				insideCount: count(personInsideSubquery.personId)
			})
			.from(building)
			.leftJoin(personInsideSubquery, eq(building.name, personInsideSubquery.entryBuilding))
			.groupBy(building.name);
	} catch (err: unknown) {
		throw new Error(
			`Failed to get inside count of persons from database: ${(err as Error).message}}`
		);
	}
}

// Creates a person and the entry timestamp
export async function createPerson(
	identifierD: string,
	type: PersonType,
	fnameD: string,
	lnameD: string,
	department: string,
	building: string,
	creator: string
): Promise<{
	id: number;
	identifier: string;
	type: PersonType;
	fname: string;
	lname: string;
	department: string;
	building: string;
	state: State;
}> {
	// Assert fname, lname and identifier are valid
	if (
		identifierD === null ||
		identifierD === undefined ||
		identifierD === '' ||
		type === null ||
		type === undefined ||
		(type as string) === '' ||
		fnameD === null ||
		fnameD === undefined ||
		fnameD === '' ||
		lnameD === null ||
		lnameD === undefined ||
		lnameD === '' ||
		department === null ||
		department === undefined ||
		department === '' ||
		building === null ||
		building === undefined ||
		building === '' ||
		creator === null ||
		creator === undefined ||
		creator === ''
	) {
		throw new Error('Invalid person data');
	}

	const identifier = sanitizeString(identifierD);
	const fname = capitalizeString(sanitizeString(fnameD));
	const lname = capitalizeString(sanitizeString(lnameD));

	try {
		return await db.transaction(async (tx) => {
			// Create the person
			const [{ id }] = await tx
				.insert(person)
				.values({ identifier, type, fname, lname, department })
				.returning({ id: person.id });

			// Create the person entry
			await tx.insert(personEntry).values({
				personId: id,
				building,
				creator
			});

			return {
				id,
				identifier,
				type,
				fname,
				lname,
				department,
				building,
				state: StateInside // Because the person was just created, they are inside
			};
		});
	} catch (err: unknown) {
		throw new Error(`Failed to create person in database: ${(err as Error).message}`);
	}
}

// Toggles the state of a person (inside to outside and vice versa)
export async function togglePersonState(
	id: number,
	building: string,
	creator: string
): Promise<State> {
	// Assert id, building and creator are valid
	if (
		id === null ||
		id === undefined ||
		building === null ||
		building === undefined ||
		building === '' ||
		creator === null ||
		creator === undefined ||
		creator === ''
	) {
		throw new Error('Invalid person data');
	}

	try {
		return await db.transaction(async (tx) => {
			// Get the person entry and exit timestamps
			const [{ entryTimestamp, exitTimestamp }] = await tx
				.select({
					id: person.id,
					entryTimestamp: max(personEntry.timestamp),
					exitTimestamp: max(personExit.timestamp)
				})
				.from(person)
				.leftJoin(personEntry, eq(person.id, personEntry.personId))
				.leftJoin(personExit, eq(person.id, personExit.personId))
				.where(eq(person.id, id))
				.groupBy(person.id);

			// Toggle the person state
			if (isInside(entryTimestamp, exitTimestamp)) {
				// Exit the person
				await tx.insert(personExit).values({
					personId: id,
					building,
					creator
				});
				return StateOutside;
			} else {
				// Enter the person
				await tx.insert(personEntry).values({
					personId: id,
					building,
					creator
				});
				return StateInside;
			}
		});
	} catch (err: unknown) {
		throw new Error(`Failed to toggle person state in database: ${(err as Error).message}`);
	}
}