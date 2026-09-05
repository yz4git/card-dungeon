export const VERSION = '1.0.0';
export const SAVE_KEY = 'card-dungeon-v1';
export const MAX_TURNS = 15;
export const WINDOW_SIZE = 5;
export const BASE_HP = 64;
export const TYPE = {
  attack: { name: '攻撃', glyph: '↗', color: '#ed9a7a' },
  guard: { name: '防御', glyph: '◇', color: '#7dbac9' },
  heal: { name: '回復', glyph: '✚', color: '#9cc99a' },
  focus: { name: '強化', glyph: '✦', color: '#cfb67b' },
};
export const CARDS = {
  slash:    { name: '斬撃', type: 'attack', attack: 10, growth: 3, detail: 'まっすぐ斬り込む、基本の一撃。' },
  cleave:   { name: '重断', type: 'attack', attack: 15, growth: 4, detail: '大きな一撃。敵が無防備な手に。' },
  pierce:   { name: '貫通', type: 'attack', attack: 9, growth: 3, pierce: true, detail: '相手の防御をすべて無視する。' },
  venom:    { name: '毒の刃', type: 'attack', attack: 5, growth: 2, poison: 2, detail: 'ダメージが通ると、次の3手に毒。' },
  drain:    { name: '吸血', type: 'attack', attack: 8, growth: 3, drain: true, detail: '与えたダメージの半分を回復。' },
  rupture:  { name: '盾砕き', type: 'attack', attack: 8, growth: 3, shatter: 12, detail: '相手が防御なら威力+12。' },
  ambush:   { name: '奇襲', type: 'attack', attack: 9, growth: 3, ambush: 8, detail: '相手が回復・強化なら威力+8。' },
  purge:    { name: '浄火', type: 'attack', attack: 8, growth: 3, cleanse: true, detail: '攻撃前に自分の毒を消す。' },
  eclipse:  { name: '月蝕', type: 'attack', attack: 14, growth: 4, pierce: true, detail: '防御を貫く、深層の秘剣。' },
  guard:    { name: '防壁', type: 'guard', guard: 12, growth: 3, detail: 'この手の攻撃ダメージを防ぐ。' },
  parry:    { name: '受け流し', type: 'guard', guard: 8, counter: 8, growth: 2, detail: '相手の攻撃に8の反撃。貫通にも反撃。' },
  thorns:   { name: '棘の盾', type: 'guard', guard: 10, counter: 5, growth: 3, detail: '相手の攻撃に5の反撃。' },
  bastion:  { name: '城塞', type: 'guard', guard: 20, growth: 4, detail: '重い一撃を受け止める。' },
  ward:     { name: '清めの盾', type: 'guard', guard: 10, growth: 3, cleanse: true, detail: '自分の毒を消して防御する。' },
  heal:     { name: '癒し', type: 'heal', heal: 12, growth: 3, detail: '攻撃を受けた後、生き残れば回復。' },
  renew:    { name: '再生', type: 'heal', heal: 6, regen: 3, growth: 2, detail: '回復し、次の3手もHPを3ずつ回復。' },
  remedy:   { name: '解毒', type: 'heal', heal: 8, growth: 3, cleanse: true, detail: '攻撃前に毒を消し、その後に回復。' },
  focus:    { name: '集中', type: 'focus', focus: 7, growth: 2, detail: '次に使う攻撃カードの威力を上げる。' },
  meditate: { name: '静心', type: 'focus', focus: 4, heal: 5, growth: 2, detail: '少し回復し、次の攻撃も強化する。' },
  aegis:    { name: '聖域', type: 'guard', guard: 13, heal: 5, growth: 3, detail: '防御と回復を同時に行う。' },
};
export const STARTER = ['slash','slash','slash','cleave','pierce','venom','guard','guard','parry','thorns','heal','heal','renew','focus','meditate'];
export const ENEMIES = [
  { id: 'sentinel', name: '朽ちた番兵', title: '錆びた剣の記憶', sprite: 0, hp: 37, deck: ['slash','guard','slash','heal','cleave','guard','focus','slash','parry','heal','slash','guard','cleave','guard','slash'], flavor: '剣の音が、まだ来ない5手を告げる。', hint: '防御に貫通を、重断に盾を合わせよう。' },
  { id: 'witch', name: '灯喰いの魔女', title: '緑炎のささやき', sprite: 1, hp: 39, deck: ['venom','focus','slash','heal','guard','drain','ward','venom','renew','pierce','guard','ambush','heal','slash','meditate'], flavor: '消えかけた灯りの奥で、呪いが息をする。', hint: '毒は3手続く。清め・解毒で消せる。' },
  { id: 'golem', name: '封印の石像', title: '目覚めた巨壁', sprite: 2, hp: 46, deck: ['bastion','focus','cleave','guard','slash','bastion','rupture','heal','guard','cleave','parry','focus','slash','bastion','cleave'], flavor: '石の継ぎ目から、太古の火が洩れる。', hint: '大きな盾には、貫通と盾砕きが有効。' },
  { id: 'warden', name: '深淵の守護者', title: '第五層の王', sprite: 3, hp: 49, deck: ['eclipse','aegis','focus','cleave','heal','parry','drain','bastion','ambush','renew','eclipse','ward','rupture','aegis','cleave'], flavor: 'その剣は、あなたの未来を断とうとしている。', hint: '防御を貫く月蝕に注意。回復の手も確保しよう。' },
];
export function cardStats(card) {
  const def = CARDS[card.key];
  if (!def) throw new Error('Unknown card: ' + card.key);
  const rank = Math.max(1, Math.min(30, Math.floor(card.rank || 1)));
  const extra = (rank - 1) * def.growth;
  return { ...def, ...card, rank, attack: def.attack ? def.attack + extra : 0, guard: def.guard ? def.guard + extra : 0, heal: def.heal ? def.heal + (def.type === 'heal' ? extra : rank - 1) : 0, focus: def.focus ? def.focus + extra : 0, counter: def.counter ? def.counter + (rank - 1) * 2 : 0, poison: def.poison ? def.poison + Math.floor((rank - 1) / 2) : 0, regen: def.regen ? def.regen + Math.floor((rank - 1) / 2) : 0 };
}
export function cardEffect(card, compact = false) {
  const c = cardStats(card);
  const parts = [];
  if(c.attack) parts.push(`${c.pierce ? '貫通' : '攻撃'} ${c.attack}`);
  if(c.guard) parts.push(`防御 ${c.guard}`);
  if(c.counter) parts.push(`反撃 ${c.counter}`);
  if(c.heal) parts.push(`回復 ${c.heal}`);
  if(c.focus) parts.push(`次撃 +${c.focus}`);
  if(c.poison && !compact) parts.push(`毒 ${c.poison}×3`);
  if(c.regen && !compact) parts.push(`再生 ${c.regen}×3`);
  return parts.join(' / ');
}
export function mainValue(c){return c.type==='focus'?c.focus:c.type==='heal'?c.heal:c.type==='guard'?c.guard:c.attack;}
export function shortEffect(c){
  if(c.pierce)return '防御無視';
  if(c.counter)return `反撃 ${c.counter}`;
  if(c.poison)return `毒 ${c.poison}×3`;
  if(c.regen)return `再生 ${c.regen}×3`;
  if(c.shatter)return `盾に +${c.shatter}`;
  if(c.ambush)return `隙に +${c.ambush}`;
  if(c.drain)return '半分吸収';
  if(c.cleanse)return '毒を解除';
  if(c.heal&&c.type!=='heal')return `回復 ${c.heal}`;
  return c.type==='focus'?'次の攻撃UP':TYPE[c.type].name;
}
