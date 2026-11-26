/**
 * 자기 전 숏폼과 알고리즘 설문 생성 스크립트
 *
 * 실행 방법: script.google.com → 새 프로젝트 → 기존 코드를 모두 지우고 이 코드 전체 붙여넣기
 *           → 저장 → 함수 선택창에서 createSurvey 선택 → 실행(▶) → 권한 허용
 * 결과:     실행 로그에 응답 URL(배포용) / 편집 URL / 응답 시트 URL 출력
 *
 * 구성: 6페이지 · 20문항
 *   첫 페이지: 0. 학년
 *   섹션 Ⅰ~Ⅴ: 로마 숫자별로 한 페이지씩
 * 익명: 이메일 수집 안 함 · 로그인 요구 안 함
 */

const SURVEY_TITLE = '자기 전 숏폼과 알고리즘 설문';
const SURVEY_DESCRIPTION =
  '자기 전 숏폼(쇼츠·릴스·틱톡) 시청 습관과 알고리즘에 대한 생각을 묻는 설문입니다. (약 3분 소요)\n\n' +
  '※ 익명으로 진행되며, 이름·이메일 등 개인정보를 수집하지 않습니다.';
const CONFIRMATION_MESSAGE = '응답해 주셔서 감사합니다! 오늘은 조금 일찍 자 보는 건 어떨까요? 🌙';
const SHEET_NAME = SURVEY_TITLE + ' (응답)';
const EXPECTED_COUNT = 20;

const FREQ4 = ['자주 있다', '가끔 있다', '거의 없다', '전혀 없다'];

function createSurvey() {
  const form = FormApp.create(SURVEY_TITLE);
  form.setDescription(SURVEY_DESCRIPTION);
  applySettings(form);

  // ===== 첫 페이지 =====
  choice(form, '0. 당신의 학년은?',
    ['1학년', '2학년', '3학년', '4학년', '대학원생 또는 그 이상']);

  // ===== Ⅰ. 응답자 정보 및 시청 습관 =====
  section(form, 'Ⅰ. 응답자 정보 및 시청 습관');
  choice(form, 'Ⅰ-1. 자기 전에 폰을 하나요?', ['예', '아니오']);
  choice(form, 'Ⅰ-2. 자기 전에 숏폼이나 릴스를 보나요?', ['예', '아니오']);
  choice(form, 'Ⅰ-3. 자기 전에 숏폼이나 릴스를 얼마나 자주 보나요?',
    ['매일', '주 4~6회', '주 1~3회', '거의 보지 않는다']);
  form.addCheckboxItem()
    .setTitle('Ⅰ-4. 숏폼을 어느 앱으로 보나요? (모두 선택)')
    .setChoiceValues(['유튜브 쇼츠', '인스타그램 릴스', '틱톡'])
    .showOtherOption(true) // '기타' + 직접 입력칸
    .setRequired(true);
  choice(form, 'Ⅰ-5. 한 번 보면 보통 얼마나 오래 보나요?',
    ['10분 이하', '10~30분', '30분~1시간', '1시간 이상']);

  // ===== Ⅱ. 추천 알고리즘에 대한 인식 =====
  section(form, 'Ⅱ. 추천 알고리즘에 대한 인식');
  choice(form, 'Ⅱ-1. 알고리즘이 자신의 취향에 잘 맞는다고 생각하시나요?',
    ['매우 그렇다', '그렇다', '보통이다', '그렇지 않다', '전혀 그렇지 않다']);
  choice(form, 'Ⅱ-2. "알고리즘이 나를 너무 잘 안다"고 느낀 적이 있나요? 그때 시청 시간이 늘어났나요?',
    ['느낀 적 있고, 시청 시간이 늘었다', '느낀 적 있지만, 시청 시간은 비슷했다', '느낀 적 없다']);
  choice(form, 'Ⅱ-3. 밤에 뜨는 영상이 낮과 다르다고 느끼나요?',
    ['더 자극적이다', '더 감성적이다', '차이 없다', '잘 모르겠다']);

  // ===== Ⅲ. 시청 지속과 멈추기 어려움 =====
  section(form, 'Ⅲ. 시청 지속과 멈추기 어려움');
  form.addMultipleChoiceItem()
    .setTitle('Ⅲ-1. 숏폼을 계속 보는 이유는 무엇인가요?')
    .setChoiceValues(['추천 영상이 취향에 맞아서', '영상이 짧아 부담이 없어서', '습관이 되어서', '잠이 오지 않아서'])
    .showOtherOption(true) // '기타' + 직접 입력칸
    .setRequired(true);
  choice(form, 'Ⅲ-2. 숏폼을 그만 보고 싶은데 멈추기 어렵다고 느낀 적이 있나요?', FREQ4);
  choice(form, 'Ⅲ-3. 다음 중 멈추기 가장 어려운 순간은?',
    ['내 취향 영상이 연달아 나올 때', '시리즈 1편을 보고 2편이 궁금할 때',
     '다음 영상이 자동으로 재생될 때', '댓글을 구경하다가', '멈추기 어렵지 않다']);
  choice(form, 'Ⅲ-4. 폰을 내려놓았다가 다시 켠 적 있나요?', FREQ4);

  // ===== Ⅳ. 취침 지연과 일상생활 영향 =====
  section(form, 'Ⅳ. 취침 지연과 일상생활 영향');
  choice(form, 'Ⅳ-1. 숏폼을 보느라 취침을 늦춘 적이 있나요?', ['예', '아니오']);
  form.addMultipleChoiceItem()
    .setTitle('Ⅳ-2. 숏폼 때문에 원래 자려던 시간보다 얼마나 늦게 자나요?')
    .setHelpText('Ⅳ-1에서 "아니오"를 골랐다면 건너뛰어도 됩니다.')
    .setChoiceValues(['30분 이하', '30분~1시간', '1~2시간', '2시간 이상'])
    .setRequired(false);
  form.addCheckboxItem()
    .setTitle('Ⅳ-3. 쇼츠 때문에 늦게 잔 다음 날 겪은 일은? (모두 선택)')
    .setChoiceValues(['1교시 지각·결석', '수업 중 졸음', '과제 미룸', '하루 종일 피곤', '없음'])
    .setRequired(true);

  // ===== Ⅴ. 반복 시청과 알고리즘에 대한 태도 =====
  section(form, 'Ⅴ. 반복 시청과 알고리즘에 대한 태도');
  choice(form, 'Ⅴ-1. 늦게 잔 걸 후회한 적이 있나요?', FREQ4);
  choice(form, 'Ⅴ-2. 그런데도 다음 날 또 보나요?', ['거의 매번 본다', '가끔 본다', '보지 않는다']);
  choice(form, 'Ⅴ-3. 알고리즘 추천을 끌 수 있다면 끄겠나요?', ['끄겠다', '끄지 않겠다', '잘 모르겠다']);
  form.addParagraphTextItem()
    .setTitle('Ⅴ-4. 숏폼과 알고리즘에 대해서 할 말이 있으면 적어주세요.')
    .setRequired(false);

  // ===== 응답 시트 연결 =====
  const ss = SpreadsheetApp.create(SHEET_NAME);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // ===== 확인 + 결과 출력 =====
  const questions = form.getItems().filter(function (it) {
    return /^(0|[ⅠⅡⅢⅣⅤ]-\d+)\./.test(it.getTitle());
  });
  if (questions.length !== EXPECTED_COUNT) {
    Logger.log('⚠️ 문항 수가 ' + EXPECTED_COUNT + '개가 아닙니다: ' + questions.length + '개');
  }
  Logger.log('✅ 설문 생성 완료 (섹션 5개 · 문항 ' + questions.length + '개)');
  Logger.log('📝 응답 URL (배포용): ' + form.getPublishedUrl());
  Logger.log('🔧 편집 URL: ' + form.getEditUrl());
  Logger.log('📊 응답 시트 URL: ' + ss.getUrl());
}

// ----- 설정 -----
function applySettings(form) {
  try {
    form.setEmailCollectionType(FormApp.EmailCollectionType.DO_NOT_COLLECT);
  } catch (e) {
    form.setCollectEmail(false);
  }
  form.setLimitOneResponsePerUser(false); // true면 로그인이 필요해져 익명성이 깨짐
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  form.setProgressBar(true);
  form.setConfirmationMessage(CONFIRMATION_MESSAGE);
  form.setAcceptingResponses(true);
  try { form.setRequireLogin(false); } catch (e) { /* 개인 계정은 해당 없음 */ }
  try { if (typeof form.setPublished === 'function') form.setPublished(true); } catch (e) {}
}

// ----- 도우미 -----
function section(form, title) {
  return form.addPageBreakItem().setTitle(title);
}

function choice(form, title, choices) {
  return form.addMultipleChoiceItem()
    .setTitle(title)
    .setChoiceValues(choices)
    .setRequired(true);
}
