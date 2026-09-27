// 게임을 브라우저 없이 로드하는 공용 하네스.
// 사용: require('./harness')(추가로 실행할 JS 문자열)
// 게임의 const 들은 eval 스코프 안에 있으므로, 검사 코드는 문자열로 넘겨
// 같은 스코프에서 실행해야 한다.
const fs = require('fs'), path = require('path');

module.exports = function run(extra) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'forge.html'), 'utf8');
  const js = html.split('<script>')[1].split('</' + 'script>')[0];

  global.localStorage = { getItem: () => null, setItem: () => {} };
  const mk = () => ({
    classList: { add(){}, remove(){}, toggle(){} }, style: {}, dataset: { p: 0 },
    children: [], appendChild(){},
    set innerHTML(v){ this._h = v }, get innerHTML(){ return this._h || '' },
    set textContent(v){ this._t = v }, get textContent(){ return this._t || '' },
    onclick: null, disabled: false
  });
  global.document = { createElement: mk, getElementById: mk, querySelectorAll: () => [], hidden: false };
  global.setInterval = () => {};
  global.setTimeout = f => f();          // 스핀 콜백 즉시 실행
  global.confirm = () => true;
  global.addEventListener = () => {};

  eval(js + '\n' + extra);
};
