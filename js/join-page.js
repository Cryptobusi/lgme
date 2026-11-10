import { parseJoinSearch, rememberJoin } from './health-invite.mjs';

const parsed = parseJoinSearch(location.search);
if (parsed.ok) rememberJoin(sessionStorage, parsed);
location.replace('/gym#/register');
