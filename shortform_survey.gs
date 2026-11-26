/**
 * 자기 전 숏폼과 알고리즘 설문 생성 스크립트
 *
 * 실행 방법: script.google.com → 새 프로젝트 → 기존 코드를 모두 지우고 이 코드 전체 붙여넣기
 *           → 저장 → 함수 선택창에서 createSurvey 선택 → 실행(▶) → 권한 허용
 * 결과:     실행 로그에 응답 URL(배포용) / 편집 URL / 응답 시트 URL 출력
 *
 * 구성: 3페이지 · 9문항
 *   1페이지: Q1
 *   2페이지: Q2~Q8  (Q1에서 '보지 않는다'를 고르면 건너뜀)
 *   3페이지: Q9 (서술형, 선택)
 * 익명: 이메일 수집 안 함 · 로그인 요구 안 함
 */

const SURVEY_TITLE = '자기 전 숏폼과 알고리즘 설문';
const SURVEY_DESCRIPTION =
  '자기 전 숏폼(쇼츠·릴스·틱톡) 시청 습관과 알고리즘에 대한 생각을 묻는 설문입니다. (약 2분 소요)\n\n' +
  '※ 익명으로 진행되며, 이름·이메일 등 개인정보를 수집하지 않습니다.';
const CONFIRMATION_MESSAGE = '응답해 주셔서 감사합니다! 오늘은 조금 일찍 자 보는 건 어떨까요? 🌙';
const SHEET_NAME = SURVEY_TITLE + ' (응답)';

function createSurvey() {
  const form = FormApp.create(SURVEY_TITLE);
  form.setDescription(SURVEY_DESCRIPTION);
  applySettings(form);

  // ===== 1페이지 =====
  const q1 = form.addMultipleChoiceItem()
    .setTitle('Q1. 자기 전에 휴대폰으로 숏폼이나 릴스를 보나요?')
    .setRequired(true);

  // ===== 2페이지: 숏폼 시청 습관 =====
  const page2 = form.addPageBreakItem()
    .setTitle('숏폼 시청 습관')
    .setHelpText('자기 전 숏폼을 볼 때를 떠올리며 답해 주세요.');

  addChoice(form, 'Q2. 자기 전에 숏폼을 보통 얼마나 오래 보나요?', [
    '10분 이하',
    '10분~30분',
    '30분~1시간',
    '1시간 이상',
  ]);

  form.addScaleItem()
    .setTitle('Q3. 알고리즘이 내 취향을 잘 알아서 더 오래 보게 된다고 느끼나요?')
    .setBounds(1, 5)
    .setLabels('전혀 그렇지 않다', '매우 그렇다')
    .setRequired(true);

  addChoice(form, 'Q4. 숏폼을 멈추기 가장 어려운 순간은?', [
    '내 취향 영상이 연달아 나올 때',
    '시리즈 1편을 보고 2편이 궁금할 때',
    '다음 영상이 자동으로 재생될 때',
    '댓글을 구경하다가',
    '멈추기 어렵지 않다',
  ]);

  addChoice(form, 'Q5. 숏폼 때문에 원래 자려던 시간보다 얼마나 늦게 자나요?', [
    '늦춘 적 없음',
    '30분 이하',
    '30분~1시간',
    '1시간 이상',
  ]);

  form.addCheckboxItem()
    .setTitle('Q6. 늦게 잔 다음 날 겪은 일은? (모두 선택)')
    .setChoiceValues([
      '1교시 지각·결석',
      '수업 중 졸음',
      '과제 미룸',
      '하루 종일 피곤',
      '없음',
    ])
    .setRequired(true);

  addChoice(form, 'Q7. 늦게 잔 걸 후회하면서도 다음 날 또 본 적이 있나요?', [
    '자주 있다',
    '가끔 있다',
    '없다',
  ]);

  addChoice(form, 'Q8. 알고리즘 추천을 끌 수 있다면 끄겠나요?', [
    '끄겠다',
    '고민해 보겠다',
    '끄지 않겠다',
  ]);

  // ===== 3페이지: 자유 의견 =====
  const page3 = form.addPageBreakItem().setTitle('자유 의견');
  form.addParagraphTextItem()
    .setTitle('Q9. 숏폼과 알고리즘에 대해서 할 말이 있으면 적어주세요.')
    .setRequired(false);

  // Q1 보기: '보지 않는다'를 고르면 2페이지를 건너뛰고 3페이지로 이동
  q1.setChoices([
    q1.createChoice('거의 매일 본다', page2),
    q1.createChoice('가끔 본다', page2),
    q1.createChoice('보지 않는다', page3),
  ]);

  // ===== 응답 시트 연결 =====
  const ss = SpreadsheetApp.create(SHEET_NAME);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // ===== 확인 + 결과 출력 =====
  const questions = form.getItems().filter(function (it) {
    return /^Q\d+\./.test(it.getTitle());
  });
  if (questions.length !== 9) {
    Logger.log('⚠️ 문항 수가 9개가 아닙니다: ' + questions.length + '개');
  }
  Logger.log('✅ 설문 생성 완료 (문항 ' + questions.length + '개)');
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
function addChoice(form, title, choices) {
  return form.addMultipleChoiceItem()
    .setTitle(title)
    .setChoiceValues(choices)
    .setRequired(true);
}
