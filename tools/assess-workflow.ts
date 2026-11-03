import { writeFileSync } from 'node:fs';
import { assessWorkflow, readAssessment, serializeAssessment } from './lib/workflow-assessment.ts';
import { parseOptions, requiredOption } from './lib/options.ts';
import { isMain, main, writeJson } from './lib/runtime.ts';

if (isMain(import.meta.url)) await main(() => {
  try {
    const options = parseOptions({ packet: { type: 'string' }, 'packet-sha': { type: 'string' },
      result: { type: 'string' }, assessment: { type: 'string' }, out: { type: 'string' } });
    const input = { packet: requiredOption(options.packet, 'packet'),
      packetSha256: requiredOption(options['packet-sha'], 'packet-sha'), result: requiredOption(options.result, 'result') };
    const attachment = assessWorkflow(input, readAssessment(requiredOption(options.assessment, 'assessment')));
    writeFileSync(requiredOption(options.out, 'out'), serializeAssessment(attachment), { flag: 'wx' });
    writeJson({ schema: attachment.schema, assessmentSha256: attachment.assessmentSha256 });
  } catch {
    throw new Error('Workflow assessment rejected: check capture, draft, options and unused output path.');
  }
});
