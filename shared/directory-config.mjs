// Where the participant directory lives, and the shared development test account shown on its sign-in screen.
//
// DEVELOPMENT ONLY. The address is the Neon `dev` branch Function, which expires on 2026-10-28; point it at the real
// directory when there is one. The test account belongs to that branch and sees only fictional data. Delete
// DEV_TEST_ACCOUNT (set it to null) before any build that handles real participants: the sign-in screen only shows
// the note and the fill-in button while it is set.

export const DIRECTORY_URL = 'https://br-restless-sea-b5je523a-participants.compute.c-7.us-east-2.aws.neon.tech';

export const DEV_TEST_ACCOUNT = Object.freeze({ email: 'you@example.com', password: 'set-in-local-config' });
