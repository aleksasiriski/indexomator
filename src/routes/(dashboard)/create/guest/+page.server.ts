import { fail, type Actions } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

import { createPerson } from '$lib/server/db/person';
import { getDepartments } from '$lib/server/db/department';

import { formSchema } from './schema';
import type { PageServerLoad } from './$types';
import { Guest } from '$lib/types/person';

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod(formSchema));
	const departments = await getDepartments();

	return {
		form,
		departments
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await superValidate(request, zod(formSchema));
		if (!form.valid) {
			return fail(400, {
				form,
				message: 'Invalid form inputs'
			});
		}

		if (locals.session === null || locals.user === null) {
			return fail(401, {
				form,
				message: 'Invalid session'
			});
		}

		try {
			const { identifier, fname, lname, department, guarantorIdentifier } = form.data;
			const type = Guest;
			const building = locals.session.building;
			const creator = locals.user.username;
			await createPerson(
				identifier,
				type,
				fname,
				lname,
				department,
				building,
				creator,
				guarantorIdentifier
			);
		} catch (err: unknown) {
			console.debug(`Failed to create guest: ${(err as Error).message}`);
			return fail(400, {
				form,
				message: 'Guest already exists'
			});
		}

		return {
			form,
			message: 'Guest created successfully!'
		};
	}
};
