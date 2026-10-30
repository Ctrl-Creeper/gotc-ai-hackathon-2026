import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../platform.js',import.meta.url),'utf8').split("window.addEventListener('hashchange'")[0];
function context(hash='#judge',role='judge'){
  const main={innerHTML:''};
  const ctx=vm.createContext({document:{getElementById:id=>id==='platform-main'?main:{},querySelectorAll:()=>[],body:{classList:{remove(){}}}},location:{href:`https://example.test/platform.html${hash}`,hash},URL,Date,setTimeout,clearTimeout});
  vm.runInContext(source+`\nsession={role:${JSON.stringify(role)}};account=()=>{};globalThis.calls=[];renderBoard=async()=>calls.push('numeric-board');renderExhibitionBoard=async()=>calls.push('exhibition-board');renderJudge=async()=>calls.push('numeric-judge');renderExhibitionJudge=async()=>calls.push('exhibition-judge');renderLogin=role=>calls.push('login:'+role);renderWrongRole=role=>calls.push('wrong-role:'+role);`,ctx);
  return ctx;
}

test('original public routes keep numeric board and judge while exhibition uses separate suffixes',async()=>{
  for(const [hash,expected] of [['','numeric-board'],['#board','numeric-board'],['#judge','numeric-judge'],['#board-exhibition','exhibition-board'],['#judge-exhibition','exhibition-judge']]){
    const ctx=context(hash);await vm.runInContext('renderRoute()',ctx);assert.equal(ctx.calls[0],expected);
  }
  for(const hash of ['#judge','#judge-exhibition']){
    const ctx=context(hash,null);await vm.runInContext('renderRoute()',ctx);assert.equal(ctx.calls[0],'login:judge');
    const wrong=context(hash,'audience');await vm.runInContext('renderRoute()',wrong);assert.equal(wrong.calls[0],'wrong-role:judge');
  }
});

test('numeric board reads original aggregate endpoint rather than exhibition progress',async()=>{
  const requested=[];const content={innerHTML:''},status={classList:{remove(){}},innerHTML:''};
  const ctx=vm.createContext({document:{getElementById:id=>id==='board-content'?content:id==='live-status'?status:{},body:{classList:{contains:()=>false}}},location:{href:'https://example.test/platform.html#board'},URL,Date,setTimeout,clearTimeout,fetch:async url=>{requested.push(String(url));return {ok:true,json:async()=>({teams:[{number:1,name:'Numeric team',score:82.5,rank:1,judgeCount:5}],config:{minJudges:5,resultsPublished:true}})};}});
  vm.runInContext(source+'\nrouteVersion=4;',ctx);await vm.runInContext('loadBoard(4)',ctx);
  assert.equal(requested[0],'https://example.test/api/board');assert.match(content.innerHTML,/82\.50/);assert.match(content.innerHTML,/专业均分/);
});

test('numeric score events submit numeric values and do not let a late save replace another team input',async()=>{
  let resolveSave;const inputs=Array.from({length:6},(_,i)=>({value:String(i+0.1),dataset:{score:String(i)},disabled:false}));
  const sliders=inputs.map((input,i)=>({value:input.value,dataset:{slider:String(i)},disabled:false}));
  const feedback={value:'Synthetic numeric feedback',disabled:false},error={textContent:''},submit={disabled:false},draft={disabled:false},recuse={disabled:false},total={innerHTML:''};
  const form={isConnected:true,elements:{feedback,...Object.fromEntries(inputs.map((input,i)=>[`score${i}`,input]))},addEventListener(type,listener){this[type]=listener;},reportValidity:()=>true,querySelector(selector){if(selector==='[type=submit]')return submit;if(selector==='.form-error')return error;return sliders[Number(selector.match(/\d+/)?.[0])];},querySelectorAll(selector){return selector==='[data-score]'?inputs:selector==='[data-slider]'?sliders:[...inputs,...sliders,feedback,submit,draft,recuse];}};
  const main={innerHTML:''},elements={'platform-main':main,'judge-editor':{innerHTML:''},'score-form':form,'save-draft':draft,recuse,'score-total':total};let payload;
  const ctx=vm.createContext({document:{getElementById:id=>elements[id]},location:{href:'https://example.test/platform.html#judge'},URL,Date,setTimeout,clearTimeout,fetch:async(_url,options)=>{payload=JSON.parse(options.body);return new Promise(resolve=>{resolveSave=()=>resolve({ok:true,json:async()=>({ok:true})});});}});
  const data={teams:[{id:'T1',number:1,name:'A'}],myScores:[],dimensions:inputs.map((_,i)=>({name:`Dimension ${i}`,max:i<3?20:i<5?15:10})),scoringOpen:true};
  vm.runInContext(source+`\nroute='judge';routeVersion=1;selectedTeam='T1';judgeData=${JSON.stringify(data)};renderJudgeEditor();`,ctx);
  sliders[0].value='19.5';sliders[0].oninput();assert.equal(inputs[0].value,'19.5');assert.match(total.innerHTML,/35\.0/);
  form.input();const saving=draft.onclick({currentTarget:draft});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(payload.status,'draft');assert.equal(payload.scores[0],19.5);assert(payload.scores.every(n=>typeof n==='number'));
  form.isConnected=false;main.innerHTML='OTHER_TEAM_UNSAVED';vm.runInContext("selectedTeam='T2';scoreDirty=true;",ctx);resolveSave();await saving;
  assert.equal(main.innerHTML,'OTHER_TEAM_UNSAVED');assert.equal(vm.runInContext('scoreDirty',ctx),true);
});
