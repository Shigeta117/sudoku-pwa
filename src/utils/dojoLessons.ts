import { STRATEGY } from 'sudoku-core';
import { Difficulty } from '../types/sudoku';

export interface DojoLesson {
  /** Same id as the example file in src/data/dojo/ */
  id: string;
  strategy: string;
  title: string;
  /** English name, as seen in other apps and on the web */
  aka: string;
  /** The game difficulty where this technique first becomes necessary */
  level: Difficulty;
  summary: string;
  /** Paragraphs: what the pattern is and why the deduction holds */
  body: string[];
  /** How to spot it on a real board */
  tip: string;
}

export const DOJO_TERMS: Array<{ term: string; meaning: string }> = [
  { term: '行', meaning: '横 1 列の 9 マス' },
  { term: '列', meaning: '縦 1 列の 9 マス' },
  { term: 'ブロック', meaning: '太線で囲まれた 3×3 の 9 マス' },
  { term: '候補', meaning: 'そのマスに入る可能性がまだ残っている数字。盤面の小さい数字（メモ）' },
  {
    term: '見える',
    meaning: '同じ行・列・ブロックのどれかに入っていること。見えるマスどうしには同じ数字が入らない',
  },
  {
    term: '2 択の組',
    meaning:
      'ある数字が、ある行（列・ブロック）の中で 2 か所にしか入れないとき、その 2 マス。片方に入らなければもう片方に必ず入る',
  },
];

export const DOJO_LESSONS: DojoLesson[] = [
  // 初級
  {
    id: 'open-singles',
    strategy: STRATEGY.OPEN_SINGLES,
    title: 'ラスト 1 マス',
    aka: 'Open Single / Full House',
    level: 'easy',
    summary: '空きが 1 マスだけの行・列・ブロックには、足りない数字が入る。',
    body: [
      '行・列・ブロックには 1〜9 が 1 回ずつ入ります。8 マスが埋まっていれば、残りの 1 マスに入る数字は 1 つに決まります。',
    ],
    tip: 'ほとんど埋まっている行・列・ブロックから見ると、すぐ見つかります。',
  },
  {
    id: 'hidden-single',
    strategy: STRATEGY.HIDDEN_SINGLE,
    title: '隠れたシングル',
    aka: 'Hidden Single',
    level: 'easy',
    summary: 'ある数字が、ブロック（行・列）の中で 1 か所にしか入れない。',
    body: [
      '数字を 1 つ決めて、その数字がまだ無いブロックを見ます。その数字がすでにある行と列は、ブロックの中でも使えません。',
      '使えないマスを消していって空きが 1 マスだけ残れば、そこに入ります。行や列についても同じことができます。',
    ],
    tip: '盤面にたくさん出ている数字から順に、まだ入っていないブロックを調べると見つけやすいです。',
  },
  // 中級
  {
    id: 'naked-single',
    strategy: STRATEGY.NAKED_SINGLE,
    title: '裸のシングル',
    aka: 'Naked Single',
    level: 'medium',
    summary: 'あるマスに入れられる数字が 1 つしか残っていない。',
    body: [
      '1 つのマスに注目して、同じ行・列・ブロックにすでにある数字を全部除きます。残った数字が 1 つだけなら、それが答えです。',
      '隠れたシングルが「数字から場所を探す」のに対して、こちらは「場所から数字を探す」考え方です。',
    ],
    tip: '行・列・ブロックの数字が多く交わるマスほど、候補が 1 つに絞られやすいです。',
  },
  {
    id: 'pointing',
    strategy: STRATEGY.POINTING_ELIMINATION,
    title: 'ポインティング',
    aka: 'Pointing / Locked Candidates',
    level: 'medium',
    summary: 'ブロックの中で候補が 1 本の行（列）にそろうと、その先の同じ行（列）から消せる。',
    body: [
      'あるブロックの中で、数字 N の候補が 1 本の行の上にしか無いとします。ブロックには N が必ず 1 つ入るので、その行の N はこのブロックの中で使われます。',
      'すると、同じ行のブロックの外のマスには N が入りません。そこから N の候補を消せます。列でも同じです。',
      '逆向きもあります。行の中で N の候補が 1 つのブロックの中にしか無ければ、そのブロックの残りのマスから N を消せます。',
    ],
    tip: '候補が 2〜3 個だけ横（縦）一直線に並んでいるブロックを探します。',
  },
  // 上級
  {
    id: 'naked-pair',
    strategy: STRATEGY.NAKED_PAIR,
    title: '裸のペア',
    aka: 'Naked Pair',
    level: 'hard',
    summary: '同じ行（列・ブロック）の 2 マスの候補が、同じ 2 つの数字だけ。',
    body: [
      '例えば同じ行の 2 マスの候補がどちらも {3, 5} だけなら、3 と 5 はこの 2 マスで使い切ります。どちらがどちらかはまだ分かりません。',
      'それでも、同じ行のほかのマスには 3 も 5 も入らないので、そこから 3 と 5 の候補を消せます。',
    ],
    tip: '候補が 2 つだけのマスを見つけたら、同じ行・列・ブロックに同じ組み合わせがないか探します。',
  },
  {
    id: 'naked-triple',
    strategy: STRATEGY.NAKED_TRIPLE,
    title: '裸のトリプル',
    aka: 'Naked Triple',
    level: 'hard',
    summary: '同じ行（列・ブロック）の 3 マスの候補を合わせると、3 種類の数字しかない。',
    body: [
      '裸のペアの 3 マス版です。3 マスの候補を合わせて 3 種類（例: 1, 2, 3）しかなければ、その 3 つの数字はこの 3 マスで使い切ります。',
      '各マスが 3 つ全部を候補に持つ必要はありません。{1, 2}・{2, 3}・{1, 3} でも成り立ちます。同じ行（列・ブロック）のほかのマスから 1・2・3 を消せます。',
    ],
    tip: '候補が 2〜3 個のマスが 3 つ集まっている行・列・ブロックを探します。',
  },
  {
    id: 'hidden-pair',
    strategy: STRATEGY.HIDDEN_PAIR,
    title: '隠れたペア',
    aka: 'Hidden Pair',
    level: 'hard',
    summary: '2 つの数字が入れる場所が、どちらも同じ 2 マスだけ。',
    body: [
      'ある行で、数字 2 と 4 が入れる場所が両方とも同じ 2 マスだけだとします。2 と 4 はこの行のどこかに必ず入るので、その 2 マスは 2 と 4 で埋まります。',
      'その 2 マスにある 2 と 4 以外の候補は全部消せます。裸のペアの裏返しで、ほかの候補に紛れて「隠れて」います。',
    ],
    tip: '行・列・ブロックの中で、候補として 2 回しか出てこない数字を 2 つ探し、出てくる場所が同じか確かめます。',
  },
  {
    id: 'hidden-groups',
    strategy: STRATEGY.HIDDEN_GROUPS,
    title: '隠れたトリプル・クワッド',
    aka: 'Hidden Triple / Quad',
    level: 'hard',
    summary: '3 つ（4 つ）の数字が入れる場所が、合わせて同じ 3 マス（4 マス）だけ。',
    body: [
      '隠れたペアの 3 つ・4 つ版です。ある行で、3 つの数字の入れる場所を全部合わせても 3 マスしかなければ、その 3 マスはその 3 つの数字で埋まります。',
      'その 3 マスにあるほかの候補を消せます。4 つの数字と 4 マスでも同じです。',
    ],
    tip: '見つけるのは難しい技です。候補の少ない数字を組み合わせて、出てくる場所が重なるか調べます。',
  },
  {
    id: 'x-wing',
    strategy: STRATEGY.X_WING,
    title: 'X-Wing',
    aka: 'X-Wing',
    level: 'hard',
    summary: '2 本の行で同じ数字の 2 択の組が、同じ 2 本の列にそろって長方形を作る。',
    body: [
      '数字 N が、ある行では 2 か所にしか入れず、別の行でも 2 か所にしか入れないとします。しかもその場所が同じ 2 本の列にそろっていて、4 マスが長方形の 4 隅になっています。',
      'どちらの行も、N は自分の 2 隅のどちらかに入ります。どの場合でも、2 本の列にはそれぞれ N が 1 つずつ入ることになります。',
      'だから、その 2 本の列のほかのマス（長方形の外）からは N を消せます。行と列を入れ替えた形もあります。',
    ],
    tip: '数字を 1 つ決め、候補がちょうど 2 か所の行を全部書き出して、列の位置が同じ 2 本を探します。',
  },
  {
    id: 'swordfish',
    strategy: STRATEGY.SWORDFISH,
    title: 'ソードフィッシュ',
    aka: 'Swordfish',
    level: 'hard',
    summary: 'X-Wing の 3 本版。3 本の行の候補が、同じ 3 本の列の中に収まる。',
    body: [
      '数字 N の候補が、3 本の行のそれぞれで 2〜3 か所にあり、その場所が全部同じ 3 本の列の中に収まっているとします。',
      '3 本の行にはそれぞれ N が 1 つ入り、それが 3 本の列に 1 つずつ割り振られます。だから、その 3 本の列のほかのマスからは N を消せます。',
    ],
    tip: 'X-Wing が見つからないとき、候補が 2〜3 か所の行を 3 本組み合わせて探します。',
  },
  // 達人
  {
    id: 'skyscraper',
    strategy: STRATEGY.SKYSCRAPER,
    title: 'スカイスクレイパー',
    aka: 'Skyscraper',
    level: 'expert',
    summary: '2 本の列の 2 択の組が、片方の端だけ同じ行にそろう形。',
    body: [
      '数字 N が、2 本の列のそれぞれで 2 か所にしか入れないとします。片方の端どうしは同じ行にあり（土台）、もう片方の端どうしは行がずれています（屋根）。',
      '土台の 2 マスは同じ行なので、両方に N は入りません。少なくとも一方の列では、N が屋根の側に入ります。',
      'つまり 2 つの屋根のどちらかには必ず N が入ります。屋根の両方から見えるマスから N を消せます。',
    ],
    tip: '2 本のビルの高さが違う形です。X-Wing を探していて、1 マスだけずれている組を見つけたら試します。',
  },
  {
    id: 'two-string-kite',
    strategy: STRATEGY.TWO_STRING_KITE,
    title: 'ツーストリングカイト',
    aka: '2-String Kite',
    level: 'expert',
    summary: '行の 2 択の組と列の 2 択の組が、1 つのブロックでつながる形。',
    body: [
      '数字 N について、ある行の 2 択の組と、ある列の 2 択の組があります。行の片方の端と列の片方の端は、同じブロックに入っています（両方に N は入れません）。',
      'そのため、行のもう一方の端か、列のもう一方の端のどちらかに必ず N が入ります。その 2 マスの両方から見えるマスから N を消せます。',
    ],
    tip: '2 本の糸（行と列）が 1 つのブロックで結ばれた凧の形です。',
  },
  {
    id: 'crane',
    strategy: STRATEGY.CRANE,
    title: 'クレーン',
    aka: 'Crane (Turbot Fish)',
    level: 'expert',
    summary: 'スカイスクレイパー・カイトの仲間。2 択の組の片方がブロックの中の組。',
    body: [
      '考え方はスカイスクレイパーやカイトと同じです。数字 N の 2 択の組を 2 つ用意し、片方の端どうしを、同じ行・列・ブロックに入るようにつなぎます。つないだ端の両方に N は入れません。',
      'すると、反対側の端のどちらかに必ず N が入ります。その 2 マスの両方から見えるマスから N を消せます。クレーンでは、2 つの組の片方がブロックの中の 2 択です。',
    ],
    tip: '候補が 2 か所だけのブロックを見つけたら、その端から行か列の 2 択の組につながらないか探します。',
  },
  {
    id: 'y-wing',
    strategy: STRATEGY.Y_WING,
    title: 'Y-Wing',
    aka: 'Y-Wing / XY-Wing',
    level: 'expert',
    summary: '候補が 2 つのマス 3 つが {A,B}・{A,C}・{B,C} の形でつながる。',
    body: [
      '候補が {A, B} のマス（軸）があり、軸から見える場所に {A, C} のマスと {B, C} のマス（はさみ）があります。',
      '軸が A なら {A, C} のはさみは C になります。軸が B なら {B, C} のはさみが C になります。どちらの場合でも、はさみのどちらかは C です。',
      'だから、2 つのはさみの両方から見えるマスからは C を消せます。',
    ],
    tip: '候補が 2 つのマスに印をつけて、3 つの数字で三角形を作れる組を探します。',
  },
  {
    id: 'w-wing',
    strategy: STRATEGY.W_WING,
    title: 'W-Wing',
    aka: 'W-Wing',
    level: 'expert',
    summary: '同じ {A,B} の 2 マスを、A の 2 択の組が橋渡しする。',
    body: [
      '候補が同じ {A, B} の 2 マスがあり、互いに見えない位置にあります。別の場所に数字 A の 2 択の組があって、その一方の端は 1 つ目のマスから、もう一方の端は 2 つ目のマスから見えます。',
      'もし 2 マスが両方とも A なら、2 択の組の両端とも A になれず、矛盾します。だから 2 マスのうち少なくとも一方は B です。',
      '2 マスの両方から見えるマスからは B を消せます。',
    ],
    tip: '候補が同じ 2 つのマスが離れた場所に 2 つあったら、間をつなぐ 2 択の組を探します。',
  },
  {
    id: 'xyz-wing',
    strategy: STRATEGY.XYZ_WING,
    title: 'XYZ-Wing',
    aka: 'XYZ-Wing',
    level: 'expert',
    summary: 'Y-Wing の軸が {A,B,C} の 3 候補になった形。',
    body: [
      '軸の候補が {A, B, C}、はさみが {A, C} と {B, C} です。軸が A なら片方のはさみが C、軸が B ならもう片方のはさみが C、軸が C なら軸そのものが C です。',
      'どの場合でも、3 マスのどれかに C が入ります。軸と 2 つのはさみの 3 マス全部から見えるマスから C を消せます。',
    ],
    tip: '消せる場所は 3 マス全部から見えるマスなので、ほぼ軸と同じブロックの中です。',
  },
  {
    id: 'simple-colouring',
    strategy: STRATEGY.SIMPLE_COLOURING,
    title: 'シンプルカラーリング',
    aka: 'Simple Colouring',
    level: 'expert',
    summary: '1 つの数字の 2 択の組をつなげて 2 色に塗り分ける。',
    body: [
      '数字 N の 2 択の組を、端を共有しながらつなげていきます。つながったマスを、隣どうしが違う色になるように 2 色で塗ります。2 択なので、どちらか一方の色のマスが全部正解です。',
      '同じ色の 2 マスが同じ行・列・ブロックに入っていたら、その色は正解になれません。反対の色が正解です。',
      'また、2 色の両方のマスから見えるマスには N は入りません。',
    ],
    tip: '2 択の組がいくつも出ている数字を選び、鎖をたどって色を塗ります。',
  },
  {
    id: 'empty-rectangle',
    strategy: STRATEGY.EMPTY_RECTANGLE,
    title: 'エンプティレクタングル',
    aka: 'Empty Rectangle',
    level: 'expert',
    summary: 'ブロックの中で候補が十字の上だけにある形と、外の 2 択の組を組み合わせる。',
    body: [
      'あるブロックで、数字 N の候補が 1 本の行と 1 本の列（十字）の上にしかありません。十字から外れたマスには N が無く、長方形の空きができています。ブロックの N は十字の横棒か縦棒のどちらかに入ります。',
      'ブロックの外に、N の 2 択の組が列の上にあります。一方の端は十字の横棒と同じ行にあり、もう一方の端はブロックとは別の段（ブロックの外の行）にあります。',
      '「もう一方の端の行」と「十字の縦棒の列」が交わるマス（ブロックの外）に N を置くと、組のもう一方の端は N になれず、十字側の端が N になります。すると横棒が使えず縦棒に N が入りますが、縦棒の列にはもう N を置いているので矛盾します。だからそのマスから N を消せます。行と列を入れ替えた形もあります。',
    ],
    tip: 'N の候補が少なく、十字の形に並んでいるブロックを探します。',
  },
  {
    id: 'finned-x-wing',
    strategy: STRATEGY.FINNED_X_WING,
    title: 'フィン付き X-Wing',
    aka: 'Finned X-Wing',
    level: 'expert',
    summary: 'X-Wing にはみ出した候補（フィン）が付いた形。',
    body: [
      'ほぼ X-Wing の形ですが、片方の行に余計な候補（フィン）がはみ出しています。フィンは、その行の長方形の角と同じブロックの中にあります。',
      'フィンに N が入らなければ X-Wing が成り立ちます。フィンに N が入れば、フィンから見えるマスに N は入りません。',
      'どちらの場合でも N が入らないマスは、X-Wing で消せるマスのうちフィンと同じブロックにあるものです。そこから N を消せます。',
    ],
    tip: 'X-Wing を探していて「1 マスだけ余計」な形を見つけたら、余計な候補が角と同じブロックにあるか確かめます。',
  },
  {
    id: 'unique-rectangle',
    strategy: STRATEGY.UNIQUE_RECTANGLE,
    title: 'ユニークレクタングル',
    aka: 'Unique Rectangle',
    level: 'expert',
    summary: '答えが 1 つだけという約束を使って、2 通りの答えになる形を避ける。',
    body: [
      '正しいナンプレの答えは 1 つだけです。2 つのブロックにまたがる長方形の 4 隅が全部 {A, B} だけになると、A と B を入れ替えた答えも成り立ってしまい、答えが 2 つになります。',
      '4 隅のうち 3 隅の候補が {A, B} だけで、残りの 1 隅に {A, B} と別の候補がある場合、その 1 隅を A か B にすると答えが 2 つの形になります。だから、その 1 隅から A と B を消せます。',
    ],
    tip: '候補が同じ 2 つのマスが長方形の 3 隅に並んでいたら、4 隅目を確かめます。',
  },
  {
    id: 'wxyz-wing',
    strategy: STRATEGY.WXYZ_WING,
    title: 'WXYZ-Wing',
    aka: 'WXYZ-Wing',
    level: 'expert',
    summary: 'XYZ-Wing を 4 マスに広げた形。',
    body: [
      '4 マスの候補を合わせると、4 種類の数字 {W, X, Y, Z} しかありません。そのうち Z 以外の数字は、それを持つマスどうしが互いに見え合っていて、2 回は入れません。',
      '4 マスに 4 種類で、Z 以外は 1 回ずつしか使えないので、4 マスのどこかに必ず Z が入ります。Z を持つマス全部から見えるマスから Z を消せます。',
    ],
    tip: '候補の少ないマスが 1 つのブロックと 1 本の行（列）に固まっているところを探します。',
  },
  // 鬼
  {
    id: 'finned-swordfish',
    strategy: STRATEGY.FINNED_SWORDFISH,
    title: 'フィン付きソードフィッシュ',
    aka: 'Finned Swordfish',
    level: 'master',
    summary: 'ソードフィッシュにはみ出した候補（フィン）が付いた形。',
    body: [
      '考え方はフィン付き X-Wing と同じです。フィンに N が入らなければソードフィッシュが成り立ち、入ればフィンから見えるマスに N は入りません。',
      'ソードフィッシュで消せるマスのうち、フィンと同じブロックにあるマスから N を消せます。',
    ],
    tip: 'ソードフィッシュに 1〜2 マスだけ余計な候補がある形を探します。',
  },
  {
    id: 'jellyfish',
    strategy: STRATEGY.JELLYFISH,
    title: 'ジェリーフィッシュ',
    aka: 'Jellyfish',
    level: 'master',
    summary: 'X-Wing の 4 本版。4 本の行の候補が、同じ 4 本の列の中に収まる。',
    body: [
      '数字 N の候補が、4 本の行のそれぞれで同じ 4 本の列の中にしかありません。4 本の行の N が 4 本の列に 1 つずつ割り振られるので、その 4 本の列のほかのマスから N を消せます。',
    ],
    tip: '実戦ではまれです。X-Wing・ソードフィッシュと同じ考え方の延長だと分かれば十分です。',
  },
  {
    id: 'finned-jellyfish',
    strategy: STRATEGY.FINNED_JELLYFISH,
    title: 'フィン付きジェリーフィッシュ',
    aka: 'Finned Jellyfish',
    level: 'master',
    summary: 'ジェリーフィッシュにフィンが付いた形。',
    body: [
      'フィン付き X-Wing と同じ考え方です。ジェリーフィッシュで消せるマスのうち、フィンと同じブロックにあるマスから N を消せます。',
    ],
    tip: 'まれな技です。フィンの考え方が分かっていれば、例題で形を確かめるだけで十分です。',
  },
  {
    id: 'bug-plus-one',
    strategy: STRATEGY.BUG_PLUS_ONE,
    title: 'BUG+1',
    aka: 'BUG+1',
    level: 'master',
    summary: '候補 3 つのマスが 1 つだけ残った終盤で、そのマスの答えが決まる。',
    body: [
      '空きマスが全部候補 2 つで、どの行・列・ブロックでも各候補がちょうど 2 回ずつ出てくる状態を BUG と呼びます。この状態のナンプレは答えが無いか 2 通り以上になるので、答えが 1 つだけの正しいナンプレでは起きません。',
      '候補 3 つのマスが 1 つだけあり、ほかが全部候補 2 つなら、そのマスが BUG を防いでいます。そのマスには、同じ行（列・ブロック）の中で候補として 3 回出てくる数字が入ります。',
    ],
    tip: '終盤で候補 2 つのマスばかりになり、1 マスだけ 3 つ残っていたら疑います。',
  },
  {
    id: 'x-chain',
    strategy: STRATEGY.X_CHAIN,
    title: 'X-Chain',
    aka: 'X-Chain',
    level: 'master',
    summary: '1 つの数字の 2 択の組を長くつないだ鎖。両端のどちらかに必ず入る。',
    body: [
      '数字 N だけを見ます。2 択の組（片方でなければもう片方）と、「同じ行・列・ブロックなので両方には入れない」つながりを交互につないで、鎖を作ります。鎖は 2 択の組で始まり、2 択の組で終わります。',
      '始まりの端に N が入らなければ、鎖をたどって終わりの端に N が入ります。つまり両端のどちらかには必ず N が入るので、両端の両方から見えるマスから N を消せます。',
      'スカイスクレイパーやカイトは、この鎖の短いものです。',
    ],
    tip: '1 つの数字に絞って、2 択の組を線で結んでいくと見えてきます。',
  },
  {
    id: 'xy-chain',
    strategy: STRATEGY.XY_CHAIN,
    title: 'XY-Chain',
    aka: 'XY-Chain',
    level: 'master',
    summary: '候補 2 つのマスを、数字を受け渡しながらつないだ鎖。',
    body: [
      '候補が 2 つのマスを、隣どうしが見え合い、数字を 1 つ共有するようにつなぎます。例えば {A, B} → {B, C} → {C, A} です。',
      '始まりのマスが A でなければ B になり、次のマスは B になれないので C、その次は C になれないので A……とたどれます。始まりのマスと終わりのマスに同じ数字 A が残る形なら、どちらかは必ず A です。',
      '両端の両方から見えるマスから A を消せます。Y-Wing は 3 マスの XY-Chain です。',
    ],
    tip: '候補が 2 つのマスが多い局面で、Y-Wing を長くした形を探します。',
  },
  {
    id: 'medusa',
    strategy: STRATEGY.MEDUSA_3D,
    title: '3D メデューサ',
    aka: '3D Medusa',
    level: 'master',
    summary: 'カラーリングを複数の数字に広げたもの。',
    body: [
      'シンプルカラーリングは 1 つの数字の 2 択の組だけで色を塗りました。3D メデューサでは「候補が 2 つのマスでは、どちらか一方が正解」というつながりも使い、別の数字にも色を広げます。',
      '同じ色どうしがぶつかればその色が不正解、両方の色から見える候補は消せる、という考え方はカラーリングと同じです。',
    ],
    tip: '手で追うのは大変です。考え方を知っておけば十分で、ヒントで出たら例題で形を確かめます。',
  },
  {
    id: 'aic',
    strategy: STRATEGY.AIC,
    title: 'AIC（交互推論チェーン）',
    aka: 'Alternating Inference Chain',
    level: 'master',
    summary: '鎖の考え方の一般形。数字もマスもまたいでつなぐ。',
    body: [
      '「A でなければ B」という強いつながり（2 択）と、「A なら B ではない」という弱いつながり（見え合う、または同じマスの別の候補）を交互につなぎます。X-Chain や XY-Chain と違い、途中で数字が変わっても、同じマスの中を渡ってもかまいません。',
      '強いつながりで始まり強いつながりで終わる鎖なら、両端の候補のどちらかは必ず正しくなります。両端の両方と見え合う候補を消せます。',
    ],
    tip: 'ここまでの鎖の技はすべて AIC の特別な形です。例題で、鎖が数字とマスをどう渡るかを見てください。',
  },
  {
    id: 'nishio',
    strategy: STRATEGY.NISHIO,
    title: '仮定法（ニシオ）',
    aka: 'Nishio',
    level: 'master',
    summary: '1 つの候補を仮に置いて進め、矛盾が出たらその候補を消す。',
    body: [
      'ある候補を「ここに入る」と仮に置き、その数字について簡単な推理だけで進めます。どこかの行・列・ブロックに置けなくなるなど矛盾が出たら、仮に置いた候補は間違いなので消せます。',
      'ほかの技で進めないときの最後の手段です。試行錯誤に近いので、使う前にほかの技を見落としていないか確かめます。',
    ],
    tip: '候補が 2 つだけのマスや 2 択の組で試すと、矛盾が早く出やすいです。',
  },
];

const BY_STRATEGY = new Map(DOJO_LESSONS.map((lesson) => [lesson.strategy, lesson]));

/** Lesson for a sudoku-core strategy title, or null for techniques the dojo does not teach. */
export function lessonForStrategy(strategy: string): DojoLesson | null {
  return BY_STRATEGY.get(strategy) ?? null;
}
