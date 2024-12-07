import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '.';
import { student, studentEntry, studentExit } from './schema';
import { StateInside, StateOutside, type State } from '$lib/types/state';

export async function getStudents(
	fname: string | undefined = undefined,
	lname: string | undefined = undefined,
	index: string | undefined = undefined
): Promise<
	{
		id: number;
		fname: string;
		lname: string;
		index: string;
		state: State;
	}[]
> {
	const students = await db
		.select({
			id: student.id,
			fname: student.fname,
			lname: student.lname,
			index: student.index,
			entryTimestamp: sql<Date>`MAX(${studentEntry.timestamp})`.as('entryTimestamp'),
			exitTimestamp: sql<Date>`MAX(${studentExit.timestamp})`.as('exitTimestamp')
		})
		.from(student)
		.leftJoin(studentEntry, eq(student.id, studentEntry.studentId))
		.leftJoin(studentExit, eq(student.id, studentExit.studentId))
		.where(
			and(
				fname ? eq(student.fname, fname) : undefined,
				lname ? eq(student.lname, lname) : undefined,
				index ? eq(student.index, index) : undefined
			)
		)
		.groupBy(student.id, student.fname, student.lname, student.index);

	return students.map((s) => {
		const isInside = s.entryTimestamp > s.exitTimestamp;
		return {
			id: s.id,
			fname: s.fname,
			lname: s.lname,
			index: s.index,
			state: isInside ? StateInside : StateOutside
		};
	});
}

export async function createStudent(
	fname: string,
	lname: string,
	index: string
): Promise<{
	id: number;
	fname: string;
	lname: string;
	index: string;
	state: State;
}> {
	// Assert fname, lname and index are not null nor undefined nor empty
	if (
		fname === null ||
		fname === undefined ||
		fname === '' ||
		lname === null ||
		lname === undefined ||
		lname === '' ||
		index === null ||
		index === undefined ||
		index === ''
	) {
		throw new Error('Invalid student data');
	}

	return await db.transaction(async (tx) => {
		// Create the student
		const [{ id }] = await tx
			.insert(student)
			.values({ fname, lname, index })
			.returning({ id: student.id })
			.execute();

		// Create the student entry
		await tx.insert(studentEntry).values({ studentId: id }).execute();

		return {
			id,
			fname,
			lname,
			index,
			state: StateInside // Because the student was just created, he is inside
		};
	});
}

export async function getStudentState(id: number): Promise<State> {
	// Assert id is not null or undefined
	if (id === null || id === undefined) {
		throw new Error('Invalid student id');
	}

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
		const [{ timestamp: exitTimestamp }] = await tx
			.select({
				timestamp: studentExit.timestamp
			})
			.from(studentExit)
			.where(eq(studentExit.studentId, id))
			.orderBy(desc(studentExit.timestamp))
			.limit(1);

		// Determine if the student is inside or outside
		const isInside = entryTimestamp > exitTimestamp;

		return isInside ? StateInside : StateOutside;
	});
}

export async function toggleStudentState(id: number): Promise<State> {
	// Assert id is not null or undefined
	if (id === null || id === undefined) {
		throw new Error('Invalid student id');
	}

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
		const [{ timestamp: exitTimestamp }] = await tx
			.select({
				timestamp: studentExit.timestamp
			})
			.from(studentExit)
			.where(eq(studentExit.studentId, id))
			.orderBy(desc(studentExit.timestamp))
			.limit(1);

		// Determine if the student is inside or outside
		const isInside = entryTimestamp > exitTimestamp;

		// Toggle the student state
		if (isInside) {
			// Exit the student
			await tx.insert(studentExit).values({ studentId: id }).execute();
		} else {
			// Enter the student
			await tx.insert(studentEntry).values({ studentId: id }).execute();
		}

		// Determine the new state
		const newIsInside = !isInside;

		return newIsInside ? StateInside : StateOutside;
	});
}