import type { State } from './state';

export type PersonType = 'Student' | 'Employee' | 'Guest';
export const Employee: PersonType = 'Employee';
export const Guest: PersonType = 'Guest';
export const Student: PersonType = 'Student';

export function isPersonType(s: string): s is PersonType {
	switch (s) {
		case Employee:
		case Guest:
		case Student:
			return true;
		default:
			return false;
	}
}

export type Person = {
	id: number;
	type: PersonType;
	identifier: string;
	fname: string;
	lname: string;
	department: string;
	building: string | null;
	state: State;
};
