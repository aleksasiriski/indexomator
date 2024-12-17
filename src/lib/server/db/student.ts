import { or, desc, eq, sql } from 'drizzle-orm';
import { student, studentEntry, studentExit } from './schema/student';
import { StateInside, StateOutside, type State } from '$lib/types/state';
import { fuzzyConcatSearchFilters, fuzzySearchFilters } from './fuzzysearch';
import { isInside } from '../isInside';
import { DB as db } from './connect';
import { capitalizeString, sanitizeString } from '$lib/utils/sanitize';

// Gets all students using optional filters
export async function getStudents(
	limit: number,
	offset: number,
	searchQuery?: string
): Promise<
	{
		id: number;
		index: string;
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
		const students = await db
			.select({
				id: student.id,
				index: student.index,
				fname: student.fname,
				lname: student.lname,
				department: student.department,
				entryTimestamp: sql<Date>`MAX(${studentEntry.timestamp})`.as('entryTimestamp'),
				entryBuilding: studentEntry.building,
				exitTimestamp: sql<Date | null>`MAX(${studentExit.timestamp})`.as('exitTimestamp')
			})
			.from(student)
			.leftJoin(studentEntry, eq(student.id, studentEntry.studentId))
			.leftJoin(studentExit, eq(student.id, studentExit.studentId))
			.where(
				or(
					...(nonEmptySearchQuery
						? [
								...fuzzySearchFilters(student.index, nonEmptySearchQuery, 1, true),
								...fuzzySearchFilters(student.fname, nonEmptySearchQuery, 3),
								...fuzzySearchFilters(student.lname, nonEmptySearchQuery, 3),
								...fuzzyConcatSearchFilters(student.fname, student.lname, nonEmptySearchQuery, 3),
								...fuzzyConcatSearchFilters(student.lname, student.fname, nonEmptySearchQuery, 3)
							]
						: [])
				)
			)
			.groupBy(student.id, student.index, student.fname, student.lname, studentEntry.building)
			.limit(limit)
			.offset(offset);

		return students.map((s) => {
			return {
				id: s.id,
				index: s.index,
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

// Creates a student and the entry timestamp
export async function createStudent(
	indexD: string,
	fnameD: string,
	lnameD: string,
	department: string,
	building: string,
	creator: string
): Promise<{
	id: number;
	index: string;
	fname: string;
	lname: string;
	department: string;
	state: State;
}> {
	// Assert fname, lname and index are valid
	if (
		indexD === null ||
		indexD === undefined ||
		indexD === '' ||
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

	const index = sanitizeString(indexD);
	const fname = capitalizeString(sanitizeString(fnameD));
	const lname = capitalizeString(sanitizeString(lnameD));

	try {
		return await db.transaction(async (tx) => {
			// Create the student
			const [{ id }] = await tx
				.insert(student)
				.values({ fname, lname, index, department })
				.returning({ id: student.id });

			// Create the student entry
			await tx.insert(studentEntry).values({
				studentId: id,
				building,
				creator
			});

			return {
				id,
				index,
				fname,
				lname,
				department,
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
		throw new Error('Invalid employee data');
	}

	try {
		return await db.transaction(async (tx) => {
			// Get the student entry
			const [{ timestamp: entryTimestamp }] = await tx
				.select({
					timestamp: studentEntry.timestamp
				})
				.from(studentEntry)
				.where(eq(studentEntry.studentId, id))
				.orderBy(desc(studentEntry.timestamp))
				.limit(1);

			// Get the student exit
			const exits = await tx
				.select({
					timestamp: studentExit.timestamp
				})
				.from(studentExit)
				.where(eq(studentExit.studentId, id))
				.orderBy(desc(studentExit.timestamp))
				.limit(1);
			const exitTimestamp = exits.length > 0 ? exits[0].timestamp : null;

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
