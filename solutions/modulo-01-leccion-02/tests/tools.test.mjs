import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JsonEventCollector } from '../dist/json-events.js';

// Prueba simple de regresión sobre el mismo collector de los módulos.
test('el collector cuenta ejecuciones de herramientas', () => {
  const collector = new JsonEventCollector();
  collector.ingest({type:'session',id:'lab'});
  collector.ingest({type:'tool_execution_start',toolName:'read'});
  collector.ingest({type:'tool_execution_end',toolName:'read',isError:false});
  collector.ingest({type:'agent_settled',aborted:false});
  const summary = collector.finish(0);
  assert.equal(summary.tools.read,1);
  assert.equal(summary.ok,true);
});
