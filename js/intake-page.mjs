import { intakeText } from './intake.mjs';
import { renderProtocol } from './intake-view.mjs';

const response = await fetch('/data/intake-protocol.txt');
const text = intakeText(await response.text());
const rendered = renderProtocol(text);
rendered.host.id = 'intake-verbatim';
document.getElementById('intake-body')?.append(rendered.host);
