import type { RequestEvent } from '@sveltejs/kit';
import { INACTIVITY_TIMEOUT } from './db/session';

export function setSessionTokenCookie(event: RequestEvent, token: string, timestamp: Date): void {
	event.cookies.set('session', token, {
		httpOnly: true,
		sameSite: 'lax',
		expires: new Date(timestamp.getTime() + INACTIVITY_TIMEOUT),
		path: '/'
	});
}

export function deleteSessionTokenCookie(event: RequestEvent): void {
	event.cookies.set('session', '', {
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 0,
		path: '/'
	});
}
