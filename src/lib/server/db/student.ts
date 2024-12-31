import { or, eq, and, max, gt, count, isNull } from 'drizzle-orm';
import { student, studentEntry, studentExit } from './schema/student';
import { StateInside, StateOutside, type State } from '$lib/types/state';
import { fuzzySearchFilters } from './fuzzysearch';
import { sqlConcat, sqlLeast, sqlLevenshteinDistance } from './utils';
import { isInside } from '../isInside';
import { DB as db } from './connect';
import { capitalizeString, sanitizeString } from '$lib/utils/sanitize';
import { building } from './schema/building';

// Gets all students using optional filters
export async function getStudents(
	limit: number,
	offset: number,
	searchQuery?: string
): Promise<
	{
		id: number;
		identifier: string;
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
				studentId: studentEntry.studentId,
				maxEntryTimestamp: max(studentEntry.timestamp).as('max_entry_timestamp')
			})
			.from(studentEntry)
			.groupBy(studentEntry.studentId)
			.as('max_entry');

		const students =
			nonEmptySearchQuery !== undefined
				? await db
						.select({
							id: student.id,
							identifier: student.identifier,
							fname: student.fname,
							lname: student.lname,
							department: student.department,
							entryTimestamp: maxEntrySubquery.maxEntryTimestamp,
							entryBuilding: studentEntry.building,
							exitTimestamp: max(studentExit.timestamp),
							leastDistance: sqlLeast([
								sqlLevenshteinDistance(sqlConcat([student.identifier]), nonEmptySearchQuery),
								sqlLevenshteinDistance(sqlConcat([student.fname]), nonEmptySearchQuery),
								sqlLevenshteinDistance(sqlConcat([student.lname]), nonEmptySearchQuery),
								sqlLevenshteinDistance(
									sqlConcat([student.fname, student.lname], ' '),
									nonEmptySearchQuery
								),
								sqlLevenshteinDistance(
									sqlConcat([student.lname, student.fname], ' '),
									nonEmptySearchQuery
								)
							]).as('least_distance'),
							leastDistanceIdentifier: sqlLevenshteinDistance(
								sqlConcat([student.identifier]),
								nonEmptySearchQuery
							).as('least_distance_identifier')
						})
						.from(student)
						.leftJoin(maxEntrySubquery, eq(maxEntrySubquery.studentId, student.id))
						.leftJoin(
							studentEntry,
							and(
								eq(studentEntry.studentId, student.id),
								eq(studentEntry.timestamp, maxEntrySubquery.maxEntryTimestamp)
							)
						)
						.leftJoin(studentExit, eq(student.id, studentExit.studentId))
						.where(
							or(
								...[
									...fuzzySearchFilters([student.identifier], nonEmptySearchQuery),
									...fuzzySearchFilters([student.fname], nonEmptySearchQuery, { distance: 5 }),
									...fuzzySearchFilters([student.lname], nonEmptySearchQuery, { distance: 5 }),
									...fuzzySearchFilters([student.fname, student.lname], nonEmptySearchQuery, {
										distance: 6
									}),
									...fuzzySearchFilters([student.lname, student.fname], nonEmptySearchQuery, {
										distance: 6
									})
								]
							)
						)
						.groupBy(
							student.id,
							student.identifier,
							student.fname,
							student.lname,
							student.department,
							maxEntrySubquery.maxEntryTimestamp,
							studentEntry.building
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
							id: student.id,
							identifier: student.identifier,
							fname: student.fname,
							lname: student.lname,
							department: student.department,
							entryTimestamp: maxEntrySubquery.maxEntryTimestamp,
							entryBuilding: studentEntry.building,
							exitTimestamp: max(studentExit.timestamp)
						})
						.from(student)
						.leftJoin(maxEntrySubquery, eq(maxEntrySubquery.studentId, student.id))
						.leftJoin(
							studentEntry,
							and(
								eq(studentEntry.studentId, student.id),
								eq(studentEntry.timestamp, maxEntrySubquery.maxEntryTimestamp)
							)
						)
						.leftJoin(studentExit, eq(student.id, studentExit.studentId))
						.groupBy(
							student.id,
							student.identifier,
							student.fname,
							student.lname,
							student.department,
							maxEntrySubquery.maxEntryTimestamp,
							studentEntry.building
						)
						.orderBy(({ identifier }) => [identifier])
						.limit(limit)
						.offset(offset);

		return students.map((s) => {
			return {
				id: s.id,
				identifier: s.identifier,
				fname: s.fname,
				lname: s.lname,
				department: s.department,
				building: isInside(s.entryTimestamp, s.exitTimestamp) ? s.entryBuilding : null,
				state: isInside(s.entryTimestamp, s.exitTimestamp) ? StateInside : StateOutside
			};
		});
	} catch (err: unknown) {
		throw new Error(`Failed to get students from database: ${(err as Error).message}`);
	}
}

// Gets the count of all students that are inside, per building
export async function getStudentsCountPerBuilding(): Promise<
	{
		building: string;
		insideCount: number;
	}[]
> {
	try {
		const studentInsideSubquery = db
			.select({
				studentId: studentEntry.studentId,
				entryBuilding: studentEntry.building,
				maxEntryTimestamp: max(studentEntry.timestamp),
				maxExitTimestamp: max(studentExit.timestamp)
			})
			.from(studentEntry)
			.leftJoin(studentExit, eq(studentEntry.studentId, studentExit.studentId))
			.groupBy(studentEntry.studentId, studentEntry.building)
			.having(({ maxEntryTimestamp, maxExitTimestamp }) =>
				or(isNull(maxExitTimestamp), gt(maxEntryTimestamp, maxExitTimestamp))
			)
			.as('student_inside');

		return await db
			.select({
				building: building.name,
				insideCount: count(studentInsideSubquery.studentId)
			})
			.from(building)
			.leftJoin(studentInsideSubquery, eq(building.name, studentInsideSubquery.entryBuilding))
			.groupBy(building.name);
	} catch (err: unknown) {
		throw new Error(
			`Failed to get inside count of students from database: ${(err as Error).message}}`
		);
	}
}

// Creates a student and the entry timestamp
export async function createStudent(
	identifierD: string,
	fnameD: string,
	lnameD: string,
	department: string,
	building: string,
	creator: string
): Promise<{
	id: number;
	identifier: string;
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
		throw new Error('Invalid student data');
	}

	const identifier = sanitizeString(identifierD);
	const fname = capitalizeString(sanitizeString(fnameD));
	const lname = capitalizeString(sanitizeString(lnameD));

	try {
		return await db.transaction(async (tx) => {
			// Create the student
			const [{ id }] = await tx
				.insert(student)
				.values({ identifier, fname, lname, department })
				.returning({ id: student.id });

			// Create the student entry
			await tx.insert(studentEntry).values({
				studentId: id,
				building,
				creator
			});

			return {
				id,
				identifier,
				fname,
				lname,
				department,
				building,
				state: StateInside // Because the student was just created, they are inside
			};
		});
	} catch (err: unknown) {
		throw new Error(`Failed to create student in database: ${(err as Error).message}`);
	}
}

// Toggles the state of a student (inside to outside and vice versa)
export async function toggleStudentState(
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
		throw new Error('Invalid student data');
	}

	try {
		return await db.transaction(async (tx) => {
			// Get the student entry and exit timestamps
			const [{ entryTimestamp, exitTimestamp }] = await tx
				.select({
					id: student.id,
					entryTimestamp: max(studentEntry.timestamp),
					exitTimestamp: max(studentExit.timestamp)
				})
				.from(student)
				.leftJoin(studentEntry, eq(student.id, studentEntry.studentId))
				.leftJoin(studentExit, eq(student.id, studentExit.studentId))
				.where(eq(student.id, id))
				.groupBy(student.id);

			// Toggle the student state
			if (isInside(entryTimestamp, exitTimestamp)) {
				// Exit the student
				await tx.insert(studentExit).values({
					studentId: id,
					building,
					creator
				});
				return StateOutside;
			} else {
				// Enter the student
				await tx.insert(studentEntry).values({
					studentId: id,
					building,
					creator
				});
				return StateInside;
			}
		});
	} catch (err: unknown) {
		throw new Error(`Failed to toggle student state in database: ${(err as Error).message}`);
	}
}
