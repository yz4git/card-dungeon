export class GameAudio {
  constructor(){this.enabled=false;try{this.enabled=localStorage.getItem('card-dungeon-sound')==='on';}catch{}this.ctx=null;}
  unlock(){try{if(!this.ctx)this.ctx=new(window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch{}}
  toggle(){this.enabled=!this.enabled;try{localStorage.setItem('card-dungeon-sound',this.enabled?'on':'off');}catch{}this.unlock();if(this.enabled)this.play('start');return this.enabled;}
  tone(freq,duration=.12,type='sine',volume=.035,delay=0){
    if(!this.enabled)return;this.unlock();if(!this.ctx||this.ctx.state!=='running')return;
    const t=this.ctx.currentTime+delay,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,t);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(gain).connect(this.ctx.destination);osc.start(t);osc.stop(t+duration+.02);
  }
  play(name){
    const sounds={click:()=>this.tone(430,.07,'sine',.025),step:()=>{this.tone(72,.075,'triangle',.05);},wall:()=>this.tone(50,.09,'triangle',.035),place:()=>{this.tone(420,.08,'sine');this.tone(630,.1,'sine',.025,.035);},attack:()=>{this.tone(120,.16,'sawtooth',.024);this.tone(55,.21,'triangle',.04);},guard:()=>{this.tone(700,.16,'triangle');this.tone(1050,.13,'sine',.015,.02);},heal:()=>[392,494,587].forEach((n,i)=>this.tone(n,.26,'sine',.022,i*.07)),start:()=>[220,330,440].forEach((n,i)=>this.tone(n,.55,'sine',.024,i*.13)),victory:()=>[330,440,554,660].forEach((n,i)=>this.tone(n,.6,'sine',.03,i*.12)),defeat:()=>[220,185,146].forEach((n,i)=>this.tone(n,.6,'triangle',.022,i*.2))};sounds[name]?.();
  }
}
