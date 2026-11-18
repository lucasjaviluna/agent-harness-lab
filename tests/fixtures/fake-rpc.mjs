import { StringDecoder } from 'node:string_decoder';
let pending = '', history = [], asked = null, timer;
const decoder = new StringDecoder('utf8');
const write = record => process.stdout.write(JSON.stringify(record) + '\n');
const respond = (req, data) => write({ type:'response', id:req.id, command:req.type, success:true, data });
const finish = (text, stopReason='stop', aborted=false) => {
  write({type:'message_update', assistantMessageEvent:{type:'text_delta', delta:text}});
  write({type:'message_end',message:{role:'assistant',stopReason,content:[{type:'text',text}]}});
  write({type:'agent_end'}); write({type:'agent_settled',aborted});
};
function handle(req) {
  if (req.type === 'extension_ui_response') { if (asked && req.id === asked && req.cancelled === true) { asked=null; finish('denied'); } return; }
  switch(req.type) {
    case 'get_state': setTimeout(()=>respond(req,{messageCount:history.length}), 25); break;
    case 'get_messages': respond(req,{messages:history}); break;
    case 'get_session_stats': respond(req,{sessionFile:'/private/session.jsonl',sessionId:'private-id',userMessages:history.length,assistantMessages:history.length,tokens:{total:history.length*10},cost:history.length*0.01}); break;
    case 'new_session': history=[]; respond(req,{cancelled:false}); break;
    case 'abort': clearTimeout(timer); finish('', 'aborted', true); respond(req,{}); break;
    case 'prompt': {
      history.push(req.message);
      const ack=()=>respond(req,{disposition:'started'});
      if(req.message==='early'){finish('early'); ack();break;}
      if(req.message==='handled'){respond(req,{disposition:'handled'});break;}
      if(req.message==='reject'){write({type:'response',id:req.id,command:req.type,success:false,error:'secret'});break;}
      if(req.message==='wrong-id'){write({type:'response',id:'wrong',command:req.type,success:true});break;}
      ack();
      if(req.message==='hang') break;
      if(req.message==='bad-json'){process.stdout.write('bad json\n');break;}
      if(req.message==='truncated'){process.stdout.write('{"type":"agent_');process.exitCode=0;process.stdin.destroy();break;}
      if(req.message==='exit'){process.exit(9);}
      if(req.message==='error'){finish('partial','error');break;}
      if(req.message==='dialog'){asked='dialog-1';write({type:'extension_ui_request',id:'notification',method:'notify',message:'example'});write({type:'extension_ui_request',id:asked,method:'confirm',title:'Confirm?'});break;}
      if(req.message==='retry'){write({type:'message_end',message:{role:'assistant',stopReason:'error',content:[]}});write({type:'agent_end'}); setTimeout(()=>finish('recovered'),30);break;}
      if(req.message==='slow'){timer=setTimeout(()=>finish('late'),5000);break;}
      if(req.message==='tools'){write({type:'tool_execution_start'});write({type:'tool_execution_end',isError:true});}
      finish(req.message==='remember' ? history.join('|') : req.message);
      break;
    }
  }
}
process.stdin.on('data',chunk=>{pending+=decoder.write(chunk);let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i);pending=pending.slice(i+1);handle(JSON.parse(line));}});
process.stdin.on('end',()=>clearTimeout(timer));
