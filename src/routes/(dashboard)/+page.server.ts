import { getStudents, toggleStudentState } from '$lib/server/db/student';
import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getEmployees, toggleEmployeeState } from '$lib/server/db/employee';
import { Employee, Student, type Person } from '$lib/types/person';
import { invalidateSession } from '$lib/server/db/session';
import { deleteSessionTokenCookie } from '$lib/server/session';

export const load: PageServerLoad = async ({ url }) => {
	try {
		const searchQuery = url.searchParams.get('q') ?? undefined;
		const studentsP = getStudents(1000, 0, searchQuery);
		const employeesP = getEmployees(1000, 0, searchQuery);
		const students = await studentsP;
		const employees = await employeesP;

		const persons: Person[] = [
			...students.map((s) => ({
				id: s.id,
				type: Student,
				identifier: s.index,
				fname: s.fname,
				lname: s.lname,
				department: s.department,
				// building: s.building,
				state: s.state
			})),
			...employees.map((e) => ({
				id: e.id,
				type: Employee,
				identifier: e.email,
				fname: e.fname,
				lname: e.lname,
				department: e.department,
				// building: e.building,
				state: e.state
			}))
		];

		return {
			searchQuery,
			persons
		};
	} catch (err: unknown) {
		console.debug(`Failed to get students and employees: ${(err as Error).message}`);
		return fail(500, {
			message: 'Failed to get students and employees'
		});
	}
};

export const actions: Actions = {
	togglestate: async ({ request, locals }) => {
		try {
			const formData = await request.formData();
			const idS = formData.get('id');
			const type = formData.get('type');

			if (locals.session === null || locals.user === null) {
				return fail(401, {
					message: 'Invalid session'
				});
			}
			const building = locals.session.building;
			const creator = locals.user.username;

			// Check if the id and type are valid
			if (
				idS === null ||
				idS === undefined ||
				typeof idS !== 'string' ||
				idS === '' ||
				type === null ||
				type === undefined ||
				typeof type !== 'string' ||
				type === ''
			) {
				return fail(400, {
					message: 'Invalid or missing fields'
				});
			}

			const id = Number.parseInt(idS);
			if (type === Student) {
				await toggleStudentState(id, building, creator);
			} else if (type === Employee) {
				await toggleEmployeeState(id, building, creator);
			} else {
				return fail(400, {
					message: 'Invalid type (neither student nor employee)'
				});
			}
		} catch (err: unknown) {
			console.debug(`Failed to toggle state: ${(err as Error).message}`);
			return fail(400, {
				message: 'Failed to toggle state'
			});
		}
	},
	logout: async (event) => {
		try {
			const formData = await event.request.formData();
			const idS = formData.get('id_session');
			if (idS === null || idS === undefined || typeof idS !== 'string' || idS === '') {
				return fail(400, {
					message: 'Invalid or missing fields'
				});
			}

			await invalidateSession(idS);
			deleteSessionTokenCookie(event);
		} catch (err: unknown) {
			console.debug(`Failed to logout: ${(err as Error).message}`);
			return fail(400, {
				message: 'Failed to logout'
			});
		}

		return redirect(302, '/login');
	}
};
