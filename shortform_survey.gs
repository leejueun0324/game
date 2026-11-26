/**
 * 자기 전 숏폼과 알고리즘 설문 생성 스크립트
 *
 * 실행 방법: script.google.com → 새 프로젝트 → 기존 코드를 모두 지우고 이 코드 전체 붙여넣기
 *           → 저장 → 함수 선택창에서 createSurvey 선택 → 실행(▶) → 권한 허용
 * 결과:     실행 로그에 응답 URL(배포용) / 편집 URL / 응답 시트 URL 출력
 *
 * 구성: 섹션 Ⅰ~Ⅵ (로마 숫자별로 한 페이지씩) · 22문항
 * '기타' 보기: 직접 입력칸이 함께 나옵니다 (1, 5, 11, 13, 17번)
 * 익명: 이메일 수집 안 함 · 로그인 요구 안 함
 *
 * 디자인: '밤하늘·별' 테마. 문구에 별·달 장식을 넣었습니다.
 *        머리글 이미지(survey_header.png)와 색상은 폼 편집 화면의 🎨 테마에서 적용하세요.
 */

const SURVEY_TITLE = '자기 전 숏폼과 알고리즘 설문';
const SURVEY_DESCRIPTION =
  '⋆ ˚｡⋆ 🌙 ⋆｡˚ ⋆\n' +
  '잠들기 전, 당신의 손끝은 어디에 있나요?\n\n' +
  '자기 전 숏폼(쇼츠·릴스·틱톡) 시청 습관과 알고리즘에 대한 생각을 묻는 설문입니다.\n' +
  '⏱ 약 3분 소요\n\n' +
  '✦ 익명으로 진행되며, 이름·이메일 등 개인정보를 수집하지 않습니다.';
const CONFIRMATION_MESSAGE =
  '⋆ ˚｡⋆ 🌙 ⋆｡˚ ⋆\n' +
  '응답해 주셔서 감사합니다!\n' +
  '오늘 밤은 폰을 조금 일찍 내려놓아 보는 건 어떨까요? 좋은 꿈 꾸세요 ✨';
const DECO = '✦ ';  // 섹션 제목 앞 별 장식
const SHEET_NAME = SURVEY_TITLE + ' (응답)';
const EXPECTED_COUNT = 22;

const FREQ4 = ['자주 있다', '가끔 있다', '거의 없다', '전혀 없다'];
const OTHER = true; // '기타' + 직접 입력칸

function createSurvey() {
  const form = FormApp.create(SURVEY_TITLE);
  form.setDescription(SURVEY_DESCRIPTION);
  applySettings(form);

  // ===== Ⅰ. 응답자 기본 정보 (첫 페이지) =====
  form.addSectionHeaderItem().setTitle(DECO + 'Ⅰ. 응답자 기본 정보');
  choice(form, '1. 당신의 학년은?', ['1학년', '2학년', '3학년', '4학년'], OTHER);
  choice(form, '2. 당신의 학과는 어느 계열인가요?',
    ['인문계열', '사회계열', '교육계열', '공학계열', '자연계열', '의약계열', '예체능계열']);

  // ===== Ⅱ. 숏폼 시청 습관 =====
  section(form, 'Ⅱ. 숏폼 시청 습관');
  choice(form, '3. 자기 전에 폰을 하나요?', ['예', '아니오']);
  choice(form, '4. 자기 전에 숏폼이나 릴스를 보나요? 본다면 얼마나 자주 보나요?',
    ['매일', '주 3~6회', '주 1~2회', '보지 않는다']);
  checks(form, '5. 숏폼을 어느 앱으로 보나요? (모두 선택)',
    ['유튜브 쇼츠', '인스타그램 릴스', '틱톡'], OTHER);
  choice(form, '6. 한 번 보면 보통 얼마나 오래 보나요?',
    ['30분 이하', '30분~1시간', '1~2시간', '2시간 이상']);

  // ===== Ⅲ. 추천 알고리즘에 대한 인식 =====
  section(form, 'Ⅲ. 추천 알고리즘에 대한 인식');
  choice(form, '7. 알고리즘이 자신의 취향에 잘 맞는다고 생각하시나요?',
    ['매우 그렇다', '그렇다', '보통이다', '그렇지 않다', '전혀 그렇지 않다']);
  choice(form, '8. "알고리즘이 나를 너무 잘 안다"고 느낀 적이 있나요?', ['예', '아니오']);
  choice(form, '9. 알고리즘으로 인해 시청 시간이 늘어났다고 생각하나요?',
    ['늘어났다', '비슷했다', '줄었다', '모르겠다']);
  choice(form, '10. 밤에 뜨는 영상이 낮과 다르다고 느끼나요?',
    ['매우 다르다고 느낀다', '조금 다르다고 느낀다', '차이를 못 느낀다',
     '다르지 않다고 느낀다', '밤과 낮을 비교해 본 적이 없다']);

  // ===== Ⅳ. 시청 지속과 멈추기 어려움 =====
  section(form, 'Ⅳ. 시청 지속과 멈추기 어려움');
  checks(form, '11. 숏폼을 계속 보는 이유는 무엇인가요? (모두 선택)',
    ['추천 영상이 취향에 맞아서', '영상이 짧아 부담이 없어서', '심심해서(습관적으로)', '잠이 오지 않아서'], OTHER);
  choice(form, '12. 숏폼을 그만 보고 싶은데 멈추기 어렵다고 느낀 적이 있나요?', FREQ4);
  checks(form, '13. 다음 중 멈추기 어려운 순간은? (모두 선택)',
    ['내 취향 영상이 연달아 나올 때', '시리즈 1편을 보고 2편이 궁금할 때',
     '다음 영상이 자동으로 재생될 때', '댓글을 구경하다가', '멈추기 어렵지 않다'], OTHER);
  choice(form, '14. 폰을 내려놓았다가 다시 켠 적 있나요?', FREQ4);

  // ===== Ⅴ. 취침 지연과 일상생활 영향 =====
  section(form, 'Ⅴ. 취침 지연과 일상생활 영향');
  choice(form, '15. 숏폼을 보느라 취침을 늦춘 적이 있나요?', ['예', '아니오']);
  choice(form, '16. 숏폼 때문에 원래 자려던 시간보다 얼마나 늦게 자나요?',
    ['30분 이하', '30분~1시간', '1~2시간', '2시간 이상'])
    .setHelpText('15번에서 "아니오"를 골랐다면 건너뛰어도 됩니다.')
    .setRequired(false);
  checks(form, '17. 쇼츠 때문에 늦게 잔 다음 날 겪은 일은? (모두 선택)',
    ['1교시 지각·결석', '수업 중 졸음', '하루 종일 피곤', '없음'], OTHER);

  // ===== Ⅵ. 반복 시청과 알고리즘에 대한 태도 =====
  section(form, 'Ⅵ. 반복 시청과 알고리즘에 대한 태도');
  choice(form, '18. 늦게 잔 걸 후회한 적이 있나요?',
    ['항상 그렇다', '자주 있다', '가끔 있다', '거의 없다', '전혀 없다']);
  choice(form, '19. 그런데도 다음 날 또 보나요?',
    ['항상 본다', '거의 매번 본다', '가끔 본다', '보지 않는다']);
  choice(form, '20. 알고리즘 추천을 끌 수 있다면 끄겠나요?', ['끄겠다', '끄지 않겠다', '잘 모르겠다']);
  form.addParagraphTextItem()
    .setTitle('21. 20번 문항에 그렇게 답한 이유를 적어주세요.')
    .setRequired(true);
  form.addParagraphTextItem()
    .setTitle('22. 숏폼과 알고리즘에 대해서 할 말이 있으면 적어주세요. (선택)')
    .setRequired(false);

  // ===== 응답 시트 연결 =====
  const ss = SpreadsheetApp.create(SHEET_NAME);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // ===== 확인 + 결과 출력 =====
  const questions = form.getItems().filter(function (it) {
    return /^\d+\./.test(it.getTitle());
  });
  if (questions.length !== EXPECTED_COUNT) {
    Logger.log('⚠️ 문항 수가 ' + EXPECTED_COUNT + '개가 아닙니다: ' + questions.length + '개');
  }
  Logger.log('✅ 설문 생성 완료 (섹션 6개 · 문항 ' + questions.length + '개)');
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
  return form.addPageBreakItem().setTitle(DECO + title);
}

// 하나만 고르는 객관식 (other가 true면 '기타' + 직접 입력칸)
function choice(form, title, choices, other) {
  return form.addMultipleChoiceItem()
    .setTitle(title)
    .setChoiceValues(choices)
    .showOtherOption(!!other)
    .setRequired(true);
}

// 여러 개 고르는 체크박스 (other가 true면 '기타' + 직접 입력칸)
function checks(form, title, choices, other) {
  return form.addCheckboxItem()
    .setTitle(title)
    .setChoiceValues(choices)
    .showOtherOption(!!other)
    .setRequired(true);
}
