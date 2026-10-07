import {defineSandbox} from 'eve/sandbox';
import {JustBashSandbox} from 'eve/sandbox/just-bash';
// In-memory staging for public images; this classifier has no browser or host tools.
export const environment=JustBashSandbox.environment();
export default defineSandbox(()=>environment.open());
