'use strict';
// ============================================================
//  데이터: 캐릭터, 관계도, 스토리, 퀘스트, 건물 미션, 단톡방
// ============================================================

// 외형: hair = long | bob | short / bangs = 0 없음, 1 있음, 2 숱 많음, 0.5 숱 적음
const CHARS = [
  { id:'jueun', name:'이주은', short:'주은', tags:'#주도형 #활발함 #솔직함', hp:9, atk:9, spd:8, color:'#ff8fc4',
    gender:'여', birth:'07년생', age:20, height:167, hair:'long', bangs:2, glasses:false, hairColor:'#6b4226', hairLen:1.5,
    top:{ type:'hoodie', color:'#8e9297' }, bottom:{ type:'shorts', color:'#3b4a66' }, outfit:'회색 후드티, 짧은 반바지',
    skill:{ id:'lure', name:'유인', cd:15, intro:'함정을 설치한 후 화재경보기나 스마트폰 알람을 통하여 소리를 울림.',
      effect:'조준한 지점으로 좀비들이 몰려가고, 함정에 걸린 좀비는 움직이지 못함.' } },
  { id:'juwon', name:'이주원', short:'주원', tags:'#다정함 #공감형 #감성적', hp:3, atk:4, spd:4, color:'#6ec3ff',
    gender:'여', birth:'07년생', age:20, height:170, hair:'bob', bangs:0, glasses:false,
    top:{ type:'cardigan', color:'#f3f1ea', over:'#9a8466' }, bottom:{ type:'jeans', color:'#1d1d22' }, outfit:'긴팔셔츠에 가디건 레이어드, 검은색 청바지',
    skill:{ id:'heal', name:'회복', cd:15, intro:'주변(꽤 넓은 범위)에 있는 팀원 모두 체력을 35씩 회복. 이주원 자신도 포함.',
      effect:'근처에 쓰러진 동기가 있으면 그 자리에서 바로 일으켜 세움. 일어난 동기는 체력 절반으로 다시 싸움.' } },
  { id:'junhee', name:'이준희', short:'준희', tags:'#듬직함 #유쾌함 #여유로움', hp:7, atk:8, spd:8, color:'#c3a6ff',
    gender:'남', birth:'05년생', age:22, height:169, hair:'short', bangs:1, glasses:true,
    top:{ type:'hoodie', color:'#c9b8e8' }, bottom:{ type:'cargo', color:'#5b5f52' }, outfit:'연보라색 후드티, 카고바지',
    skill:{ id:'swing', name:'풀스윙', cd:10, need:'bat', intro:'조준한 방향 앞쪽 넓은 부채꼴(약 150도) 안의 좀비를 배트로 크게 휘둘러 침. (야구배트를 과방이나 기숙사에서 획득해야 함)',
      effect:'맞은 좀비는 큰 피해를 입고 멀리 날아가며 1초 동안 기절. 덩치 좀비는 덜 날아가고 보스는 거의 밀리지 않음.' } },
  { id:'yujun', name:'박유준', short:'유준', tags:'#책임감 #계획형 #현실적', hp:9, atk:8, spd:9, color:'#7dd87d',
    gender:'남', birth:'06년생', age:21, height:175, hair:'short', bangs:1, glasses:false,
    top:{ type:'hoodie', color:'#8e9297' }, bottom:{ type:'jeans', color:'#202226' }, outfit:'회색 후드티, 검은색 청바지',
    skill:{ id:'pitch', name:'강속구', cd:8, intro:'야구공 3개를 0.2초 간격으로 조준한 방향에 연달아 던짐. 날아가는 동안 조준을 옮기면 다음 공도 그 방향으로 날아감.',
      effect:'공 하나에 큰 피해, 맞은 좀비는 밀리며 0.7초 기절. 공은 근처 좀비에게 튕겨 최대 3마리까지 맞힘.' } },
  { id:'eunbit', name:'장은빛', short:'은빛', tags:'#조용함 #즉흥적 #신중함', hp:3, atk:3, spd:3, color:'#ffe066',
    gender:'여', birth:'06년생', age:21, height:165, hair:'long', bangs:0, forehead:true, glasses:false,
    top:{ type:'sweat', color:'#7a5236' }, bottom:{ type:'training', color:'#1d1d22' }, outfit:'갈색 맨투맨, 검은색 트레이닝 긴바지',
    skill:{ id:'note', name:'쪽지', cd:10, intro:'말없이 쪽지로 팀원들에게 작전을 전하는 조용한 신호를 보냄.',
      effect:'5초 동안 팀원 전원의 이동속도와 공격속도가 빨라짐.' } },
  { id:'jihu', name:'이지후', short:'지후', tags:'#차분함 #듬직함 #신중함', hp:9, atk:9, spd:9, color:'#b9a3ff',
    gender:'남', birth:'07년생', age:20, height:180, hair:'short', bangs:1, glasses:false,
    top:{ type:'hoodie', color:'#25315a' }, bottom:{ type:'cargo', color:'#cdb88f' }, outfit:'남색 후드티, 베이지색 카고바지',
    skill:{ id:'block', name:'블락', cd:10, intro:'달려드는 좀비를 정확한 타이밍에 쳐내 수비함.',
      effect:'2.5초 동안 앞에서 오는 공격을 모두 막고, 막은 좀비는 큰 피해를 입고 날아가며 기절함.' } },
  { id:'hyoseo', name:'권효서', short:'효서', tags:'#직설적 #화끈함 #당당함', hp:5, atk:5, spd:5, color:'#ff6b6b',
    gender:'여', birth:'07년생', age:20, height:164, hair:'long', bangs:0, forehead:true, glasses:false,
    top:{ type:'hoodie', color:'#8e9297' }, bottom:{ type:'jeans', color:'#4a6a9a' }, outfit:'회색 후드티, 청바지',
    skill:{ id:'molotov', name:'화염병 투척', cd:10, need:'molotov', intro:'소주병과 휴지로 만든 화염병. (소주병과 휴지를 획득해야 사용 가능)',
      effect:'폭발 후 5초간 불타는 지대를 만들어 좀비를 계속 태움.' } },
  { id:'suyeon', name:'황수연', short:'수연', tags:'#배려심 #현실적 #다정함', hp:3, atk:3, spd:2, color:'#5ee0c8',
    gender:'여', birth:'07년생', age:20, height:165, hair:'long', bangs:0.5, glasses:false,
    top:{ type:'hoodie', color:'#8e9297' }, bottom:{ type:'training', color:'#7d8086' }, outfit:'회색 후드티, 회색 트레이닝 긴바지',
    skill:{ id:'supply', name:'보급', cd:10, intro:'가방에 챙겨 둔 물자를 꺼내 팀에 보급.',
      effect:'구급상자·음식·소모품을 주변에 내려놓고, 근처 팀원의 체력을 조금 회복시킴.' } },
  { id:'bonwoo', name:'구본우', short:'본우', tags:'#엉뚱함 #순수함 #감성적', hp:6, atk:7, spd:8, color:'#ffa0a0',
    gender:'남', birth:'07년생', age:20, height:176, hair:'short', bangs:1, glasses:false,
    top:{ type:'cardigan', color:'#f3f1ea', over:'#c0282d' }, bottom:{ type:'slacks', color:'#2b2d33' }, outfit:'빨간 가디건, 슬렉스 바지',
    skill:{ id:'shuffle', name:'셔플', cd:15, need:'extinguisher', intro:'좀비 무리 한가운데에 연막처럼 소화기를 뿌림. (소화기를 획득해야 사용 가능)',
      effect:'하얀 가루 때문에 좀비들끼리 서로를 공격하거나 엉뚱한 방향으로 흩어짐.' } },
  { id:'seolwoo', name:'정설우', short:'설우', tags:'#효율적 #침착함 #조용함', hp:6, atk:7, spd:6, color:'#9fe86a',
    gender:'남', birth:'07년생', age:20, height:178, hair:'short', bangs:1, glasses:true, headphones:true,
    top:{ type:'hoodie', color:'#1d1d22' }, bottom:{ type:'jeans', color:'#4a6a9a' }, outfit:'검은색 후드티, 청바지, 목에 헤드폰',
    skill:{ id:'escape', name:'퇴로 확보', cd:10, intro:'위험해지기 전에 빠져나갈 길부터 만들어 둠.',
      effect:'주변 좀비를 한 번에 밀어내고, 3초 동안 팀원 전원이 받는 피해가 절반으로 줄어듦.' } },
  { id:'chaeyun', name:'이채윤', short:'채윤', tags:'#조용함 #담백함 #다정함', hp:3, atk:5, spd:4, color:'#e8e8e8',
    gender:'여', birth:'07년생', age:20, height:167, hair:'long', bangs:0, forehead:true, glasses:true,
    top:{ type:'hoodie', color:'#1d1d22' }, bottom:{ type:'jeans', color:'#4a6a9a' }, outfit:'검은색 후드티, 청바지',
    skill:{ id:'ambush', name:'매복', cd:15, intro:'숨죽인 채 기다리다 좀비가 가장 가까이 오면 팀원들에게 알림.',
      effect:'알림 후 4초 동안 팀원 전원이 표식이 붙은 좀비에게 2배 피해를 줌.' } },
];
const CHAR = Object.fromEntries(CHARS.map(c => [c.id, c]));
const ROLL_ORDER = ['hyoseo','suyeon','seolwoo','eunbit','chaeyun','jihu','junhee','bonwoo','juwon','yujun','jueun'];

// 인물 관계도 (소설 기반)
const EXTRA_NODES = [
  { id:'n1',  name:'1번', color:'#d14b4b', desc:'K-13 첫 번째 성공 사례. 감염자를 통제하며 "완전한 연결"을 꿈꾼다. 유준과 닮은 얼굴.' },
  { id:'n12', name:'12번', color:'#59a5ff', desc:'K-13 실험체. 기억 담당 매개체. 1번을 막기 위해 스스로 문을 닫는다.' },
  { id:'n13', name:'13 (ARCHIVE)', color:'#a26bff', desc:'열한 명의 기억을 저장한 K-13 기록 시스템. 사람이 아니라 "13번째 기록".' },
  { id:'k13', name:'K-13 요원', color:'#555', desc:'검은 방호복의 무장 집단. 구조대가 아니라 생존자와 감염자를 "확보"하러 온 사람들.' },
];
const RELATIONS = [
  ['jueun','yujun','0번 ↔ 11번, 끝까지 손을 놓지 않음'],
  ['jueun','juwon','새벽 창가 대화 "다 같이 나가자"'],
  ['hyoseo','jueun','출석체크를 이어 부르는 사이'],
  ['hyoseo','yujun','상처를 가장 먼저 발견'],
  ['junhee','eunbit','성산홀 계단에서 넘어진 은빛을 구함'],
  ['jihu','junhee','배트를 들고 함께 선두'],
  ['seolwoo','jihu','길을 기억하는 사람 · 출구 담당'],
  ['bonwoo','jueun','과자(비상식량) 협상 실패'],
  ['chaeyun','bonwoo','"좀비보다 네가 더 평화주의자 같아"'],
  ['suyeon','yujun','밴드로 상처를 감싸 줌'],
  ['eunbit','yujun','감염자 동행에 반대했던 갈등'],
  ['juwon','yujun','"아무도 빠지면 안 돼"'],
  ['yujun','n1','같은 곳에서 만들어진 형제 같은 존재'],
  ['yujun','n12','실험실 동기 · 유준을 위해 희생'],
  ['jueun','n13','13의 원본 기억을 가진 유일한 인간'],
  ['n1','k13','통제권을 두고 대립'],
  ['k13','yujun','"감염자는 앞으로 나오십시오"'],
];

// 스토리 장
// objective type: talk, interact(id), reach(area), collect(item,count), kill(n), survive(sec), revive(id), boss(id), gather(area)
const CHAPTERS = [
  { id:'prologue', title:'프롤로그 — 평범했던 오후', time:'2026. 6. 23. 오후 4:12', night:0, start:'room_kwabang', loc:'인문대 · 문헌정보학과 과방',
    intro:[
      ['juwon','야, 개배고픈데 뭐 먹을 사람?'], ['junhee','난 아무거나.'], ['bonwoo','아무거나가 제일 어려운 거 알지?'],
      ['yujun','투표하자 투표'], ['jueun','또 시작이네.'], ['hyoseo','아니 근데 얘들아. 학교 주변에 경찰차가 좀 많은 거 같지 않아?'],
      ['suyeon','무슨 사고 났나?'], ['eunbit','근데 저쪽에서도 사이렌 들리는데?'], ['*','운동장 한쪽에서 비명이 터졌다. "꺄아아아악!"'],
      ['bonwoo','저거…… 사람 물고 있는 거 같은데?'], ['*','휴대폰이 울렸다. 단톡방이었다.'],
    ],
    kakao:[['재난문자','[긴급재난문자] 원인불명의 감염병이 전국적으로 확산되고 있습니다. 외출을 자제하시고 안전한 장소에서 대기하시기 바랍니다.'],
           ['재난문자','감염자의 공격성이 매우 높습니다. 접촉 및 교상을 피하십시오.'],
           ['재난문자','감염자는 사망 후에도 움직일 수 있습니다.']],
    quests:[
      { text:'과방 문 잠그기', type:'interact', id:'kw_door' },
      { text:'책상 위 창고 열쇠 찾기', type:'interact', id:'kw_key' },
      { text:'창고에서 장비 챙기기 (야구배트·소화기)', type:'collect', item:'storage', count:2 },
      { text:'창고 뒤 비상구로 탈출하기', type:'reach', area:'kw_exit' },
    ],
    outro:[['hyoseo','창고 뒤에 비상구 있어. 그쪽으로!'], ['*','쩌적. 문고리가 휘었다.'], ['jihu','뛰어!']] },

  { id:'ch1', title:'1장 — 출석체크', time:'오후 4:31', night:0.1, start:'out_humanities', loc:'캠퍼스',
    intro:[
      ['juwon','잠깐. 우리 인원이 몇 명이지?'], ['yujun','열한 명.'], ['juwon','그럼 한 명씩 확인하자.'], ['*','__ROLLCALL__'],
      ['jihu','걸음걸이 봐.'], ['*','다리를 질질 끌던 사람이—달렸다.'], ['jueun','잠깐만 이쪽. 도서관!'],
    ],
    kakao:[['jueun','도서관으로 가자. 거기 문 잠글 수 있어'], ['seolwoo','정문 쪽은 막혔어요. 인문대 뒤로 돌아가요']],
    quests:[
      { text:'열한 명 모두 데리고 중앙도서관 입구까지 이동', type:'gather', area:'lib_door' },
    ],
    outro:[['*','이주은이 가장 먼저 문을 닫았다. 지후와 준희가 책상을 끌어와 입구를 막았다.'], ['eunbit','살았다…….'], ['bonwoo','저희 아직 안 죽었네요.']] },

  { id:'ch2', title:'2장 — 도서관', time:'오후 5:02', night:0.25, start:'room_library', loc:'중앙도서관',
    intro:[
      ['chaeyun','전기 나가면?'], ['yujun','냉장고 있는 곳부터 확인해야겠는데. 물도 필요하고.'],
      ['hyoseo','그리고…… 휴대폰.'], ['*','쿵. 도서관 안쪽에서 소리가 났다.'], ['junhee','……도서관 안에 우리 말고 누가 있어?'],
    ],
    kakao:[['재난문자','대구대학교 학생들은 지정 대피시설(성산홀)로 이동하십시오.']],
    quests:[
      { text:'입구 바리케이드 두 곳 세우기', type:'interact', id:'lib_barricade', count:2 },
      { text:'서가 사이에 숨은 감염자 처치', type:'kill', count:6 },
      { text:'자료실에서 물자 모으기 (물·밴드·보조배터리·손전등)', type:'collect', item:'supply', count:4 },
      { text:'자료실에서 숨 고르기', type:'reach', area:'lib_archive' },
    ],
    outro:[['hyoseo','박유준. 팔.'], ['yujun','방금 도망치다가 책장에 긁힌 거야.'], ['suyeon','나 밴드 있어.'],
      ['bonwoo','저 과자…….'], ['jueun','안 돼. 비상식량.'], ['jueun','가자. 우리 열한 명이잖아. 한 명도 빠지지 말고 가자.']] },

  { id:'ch3', title:'3장 — 성산홀', time:'오후 6:40', night:0.6, start:'out_library', loc:'성산홀',
    intro:[['*','불타는 자동차. 깨진 유리. 곳곳에서 움직이는 감염자들.'], ['chaeyun','저기! 성산홀!'], ['hyoseo','조금만 더!']],
    kakao:[['hyoseo','성산홀 정면 계단으로 가자'], ['junhee','다들 붙어서 와']],
    quests:[
      { text:'성산홀 정면 계단까지 이동', type:'reach', area:'ss_stairs' },
      { text:'계단에서 넘어진 장은빛 일으켜 세우기', type:'revive', id:'eunbit' },
      { text:'성산홀 안으로 들어가 정문 잠그기', type:'interact', id:'ss_door' },
      { text:'밤새 버티기 — 창문과 옆문으로 들어오는 감염자 막기', type:'survive', sec:90 },
    ],
    outro:[['*','치직— "단, 대피구역의 위치는 공개하지 않습니다."'], ['*','대구의 불빛이 하나씩 꺼졌다. 그리고—전부.'],
      ['*','저장되지 않은 번호: "내일 오전 6시, 운동장에 헬기가 옵니다. 열한 명이라면…… 전부 데리고 오십시오."'],
      ['hyoseo','그럼 내일 6시까지 살아남자.'], ['*','열한 개의 손이 겹쳐졌다. "아자스."']] },

  { id:'ch4', title:'4장 — 의심 그리고 06:00', time:'새벽 5:17', night:0.85, start:'room_seongsan', loc:'성산홀 → 대운동장',
    intro:[['juwon','헬기 진짜 올까?'], ['jueun','모르겠어.'], ['*','철컥. 누군가 계단 쪽으로 걸어가고 있었다.']],
    kakao:[['???','열한 명은 절대로 운동장으로 가지 마십시오. 그곳에는 구조대가 없습니다.'],
           ['방송','생존자는 운동장으로 이동하십시오. 구조 헬기가 곧 도착합니다.']],
    quests:[
      { text:'계단 쪽으로 사라진 사람 따라가기', type:'reach', area:'ss_back' },
      { text:'대화하기', type:'talk', lines:[['jueun','……박유준?'], ['yujun','헬기…… 안 와.'], ['*','치직— "당신들 중 한 명은 이미 감염되었습니다."'],
        ['hyoseo','……붕대 풀어.'], ['*','상처 주변 피부가 검게 변하고 있었다.'], ['yujun','그래서 혼자 나가려고 했어.'],
        ['jueun','같이 가. 우리 열한 명이라고 했잖아.'], ['juwon','둘 중 하나는 구라네.']] },
      { text:'오전 6시 — 대운동장으로 이동', type:'reach', area:'field_center' },
      { text:'K-13 요원을 피해 지하 주차장 입구로 탈출', type:'reach', area:'parking_ramp' },
    ],
    outro:[['*','헬기 기체 측면에는 검은 글자가 적혀 있었다. K-13.'], ['junhee','저거 구조대 아닌데.'], ['jueun','저쪽! 지하 주차장!']] },

  { id:'ch5', title:'5장 — 지하', time:'오전 6:09', night:1, start:'room_parking', loc:'지하 주차장',
    intro:[['bonwoo','여기…… 주차장 맞지?'], ['*','벽에 피로 쓴 글씨. K-13 / 11 / 10'], ['*','어둠 속에서 목소리가 들렸다. "도와주세요……"'],
      ['jihu','우리가 하는 말을 따라 하고 있어.'], ['*','"우리가 하는 말을 따라 하고 있어."']],
    kakao:[['seolwoo','벽 쪽에 배전함 있어요. 퓨즈 넣으면 철문 열릴 듯'], ['jueun','다들 손전등 켜']],
    quests:[
      { text:'주차장 곳곳의 퓨즈 3개 찾기', type:'collect', item:'fuse', count:3 },
      { text:'모방체(4단계 감염자)를 피해 배전함에 퓨즈 넣기', type:'interact', id:'pk_panel' },
      { text:'유준이 시간을 버는 동안 철문 밖으로 탈출', type:'reach', area:'pk_exit' },
    ],
    outro:[['yujun','……출석체크 해. 다 들어갔는지 확인하라고.'], ['*','쿵. 문이 닫혔다.'], ['*','"……열한 명. 전부 살아남아."'],
      ['*','__ROLLCALL10__'], ['jueun','열 명이네.']] },

  { id:'ch6', title:'6장 — K-13 연구소', time:'오전 7:11', night:1, start:'room_lab', loc:'학교 지하 K-13 연구소',
    intro:[['*','산 아래, 수백 마리의 좀비가 줄지어 서 있었다. 그 중심에—박유준.'], ['yujun','얘들아. 왜 두고 갔어?'],
      ['yujun','지하 연구소가 있어. 학교 아래.'], ['*','삑. 문이 열렸다. 화면: SURVIVORS 11 — WELCOME BACK, 11.'],
      ['*','12번: "오랜만이야, 11번."'], ['*','1번: "이번에는 내가 출석을 부를게."']],
    kakao:[['12번','단말기 세 곳에서 K-13 기록을 확보해. 1번이 오기 전에.'], ['13','13번이 연결을 요청합니다.']],
    quests:[
      { text:'연구소 단말기 3곳 조사하기', type:'interact', id:'lab_term', count:3 },
      { text:'1번 쓰러뜨리기 (감염자를 통제하는 첫 번째 실험체)', type:'boss', id:'n1' },
      { text:'중앙 장치 연결 — 13의 연결이 끊길 때까지 버티기', type:'survive', sec:45, at:'lab_core' },
    ],
    outro:[['*','DO YOU WANT TO FORGET?'], ['jueun','아니.'], ['yujun','우리가 기억할게.'],
      ['*','ARCHIVE TRANSFER — MEMORY RETURNED TO SUBJECTS'], ['*','오전 8시 47분. 대구 상공의 헬기들이 방향을 바꿨다. 도시는 살아남았다.'],
      ['*','__ROLLCALL__'], ['jueun','이제 번호로 기억할 필요 없잖아. 우리가 서로 이름을 기억하니까.']] },
];

// 건물 미션 (자유 수행, 보상)
const BUILDING_MISSIONS = [
  { id:'bm_kwabang', bld:'인문대', text:'과방 사물함에서 휴대폰 보조배터리 찾기', item:'battery', reward:'phone', rewardText:'단톡방 알림 + 휴대폰 배터리 충전' },
  { id:'bm_library', bld:'중앙도서관', text:'자료실 깊은 곳 손전등 찾기', item:'flashlight', reward:'light', rewardText:'밤 시야 확대' },
  { id:'bm_store', bld:'학생회관 · 편의점', text:'편의점에서 소주병과 휴지 챙기기', item:'molotov', reward:'molotov', rewardText:'화염병 재료 +2' },
  { id:'bm_dorm', bld:'행복기숙사', text:'기숙사 방에서 야구배트 찾기', item:'bat', reward:'bat', rewardText:'야구배트 (준희 스킬 해금)' },
  { id:'bm_biho', bld:'비호생활관', text:'휴게실 비상식량 상자 열기', item:'ration', reward:'heal', rewardText:'팀 전원 체력 회복' },
  { id:'bm_eng', bld:'공과대학', text:'실습실에서 쇠파이프 확보', item:'pipe', reward:'pipe', rewardText:'쇠파이프 (공격력 상승)' },
  { id:'bm_edu', bld:'사범대학', text:'복도 소화기 2개 회수', item:'extinguisher', reward:'ext', rewardText:'소화기 (본우 스킬 해금)' },
  { id:'bm_seongsan', bld:'성산홀', text:'강당 방송실에서 무전기 찾기', item:'radio', reward:'radio', rewardText:'K-13 무전 도청 (적 위치 표시)' },
];

// 단톡방 자동 대화 / DM 응답
const IDLE_CHAT = {
  jueun:['다들 어디야 위치 찍어', '한 명도 빠지면 안 돼', 'ㅋㅋㅋㅋㅋ 아 진짜 무서워'],
  juwon:['다친 사람 있으면 바로 말해줘', '배고프다…', '우리 다 같이 나가자'],
  junhee:['배트 있으면 나 줘', '여유롭게 가자 여유롭게', '앞은 내가 볼게'],
  yujun:['투표하자 투표', '나 괜찮아', '계획은 내가 짤게'],
  eunbit:['나 오늘 오하아사 1등인데…… 왜이래...', '……', '쪽지 보냄'],
  jihu:['뒤쪽 조용해요', '손전등 켤게요', '천천히 가요'],
  hyoseo:['출석체크 다시 한다', '문 닫아!', '지금은 감사해야 할 듯'],
  suyeon:['밴드 필요한 사람?', '물 아껴 마셔', '빨리 끝내면 안 되나 진짜'],
  bonwoo:['손전등 있나요?', '저 과자……', '저희 아직 안 죽었네요'],
  seolwoo:['길은 제가 기억합니다', '오른쪽이 안전합니다', '다친 사람 있습니까?'],
  chaeyun:['여기', '나 물도 있어', '조용히…… 뭔가 와'],
};
const DM_REPLY = {
  jueun:['응 나 여기 있어', '걱정 마. 다 같이 나갈 거야', '너도 조심해'],
  juwon:['괜찮아? 다친 데 없어?', '내가 옆에 있을게', '배고프면 말해 ㅠ'],
  junhee:['ㅇㅋ', '내 뒤로 와', '여유 있게 가자'],
  yujun:['…나 괜찮아', '미안. 아직 다 말 못 했어', '혼자 나가진 않을게'],
  eunbit:['……응', '쪽지 줄게', '무서워도 같이 가'],
  jihu:['네 알겠어요', '제가 앞에 설게요', '조용히 따라오세요'],
  hyoseo:['왜', '지금 그런 얘기 할 때 아님', '살아남자 일단'],
  suyeon:['밴드 남았어', '물 마셔', '너 진짜 괜찮은 거 맞지?'],
  bonwoo:['넵!', '손전등 켜드릴까요?', '과자 반 입만……'],
  seolwoo:['확인했습니다', '출구는 제가 찾겠습니다', '침착하게 가죠'],
  chaeyun:['ㅇㅇ', '여기 있어', '뒤에 조심해'],
};
