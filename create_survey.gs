/**
 * 강의 만족도 설문 생성 스크립트
 * 「클로드 코드를 사용한 업무자동화」
 *
 * 실행 방법: script.google.com → 새 프로젝트 → 이 코드 전체 붙여넣기
 *           → 함수 선택창에서 createSurvey 선택 → 실행(▶) → 권한 허용
 * 결과:     실행 로그에 응답 URL(수강생 배포용) / 편집 URL(강사용) / 응답 시트 URL 출력
 *
 * 구성: 5개 섹션(페이지) · 12문항
 *       객관식 3 · 5점 척도 6 · 복수 선택 1 · 서술형 2(선택 응답)
 * 익명: 이메일 수집 안 함 · 로그인 요구 안 함 · 응답 횟수 제한 안 함
 */

const SURVEY_TITLE = '[강의 만족도 조사] 클로드 코드를 사용한 업무자동화';
const SURVEY_DESCRIPTION =
  '오늘 강의에 참여해 주셔서 감사합니다.\n' +
  '더 나은 강의를 위해 솔직한 의견을 들려주세요. (약 3분 소요)\n\n' +
  '※ 이 설문은 익명으로 진행되며, 이름·이메일 등 개인정보를 수집하지 않습니다.\n' +
  '※ 서술형 문항에도 개인정보나 회사 기밀은 적지 말아 주세요.';
const CONFIRMATION_MESSAGE =
  '소중한 의견 감사합니다! 오늘 배운 것 중 한 가지만 시작해 보세요.';
const SHEET_NAME = SURVEY_TITLE + ' (응답)';

const SCALE_LOW = '전혀 그렇지 않다';
const SCALE_HIGH = '매우 그렇다';

function createSurvey() {
  const form = FormApp.create(SURVEY_TITLE);
  form.setDescription(SURVEY_DESCRIPTION);
  applySettings(form);

  // ===== A. 응답자 정보 =====
  form.addSectionHeaderItem()
    .setTitle('A. 응답자 정보')
    .setHelpText('응답 결과를 경험 수준별로 나눠 보기 위한 문항입니다.');

  addChoice(form, 'Q1. 평소 AI 도구(ChatGPT, Claude 등)를 얼마나 사용하시나요?', [
    '매일',
    '주 몇 회',
    '월 몇 회',
    '거의 사용 안 함',
  ]);
  addChoice(form, 'Q2. Claude Code를 사용해 본 경험이 있나요?', [
    '오늘 처음 사용',
    '설치만 해 봄',
    '가끔 사용',
    '업무에 자주 사용',
  ]);

  // ===== B. 전반 만족도 =====
  addSection(form, 'B. 전반 만족도', '1점 = 전혀 그렇지 않다, 5점 = 매우 그렇다');
  addScale(form, 'Q3. 오늘 강의에 전반적으로 만족하시나요?');
  addScale(form, 'Q4. 시간 배분(이론 40분 · 실습 40분 · Q&A 30분)이 적절했나요?');

  // ===== C. 파트별 평가 =====
  addSection(form, 'C. 파트별 평가', '1부 이론과 2부 실습을 나눠서 평가해 주세요.');
  addScale(form, 'Q5. [1부 이론] AI 자동화 3단계와 자동화 대상 선정 기준을 이해했나요?');
  addScale(form, 'Q6. [1부 이론] 좋은 프롬프트 구조와 검증 방법을 업무에 적용할 수 있을 것 같나요?');
  addChoice(form, 'Q7. [2부 실습] 실습 난이도는 어땠나요?', [
    '너무 쉬움',
    '적당함',
    '약간 어려움',
    '너무 어려움',
  ]);
  addScale(form, 'Q8. [2부 실습] 실습(설문 분석기, 채용공고 모니터링)의 흐름을 직접 따라 할 수 있었나요?');

  // ===== D. 활용 의향 =====
  addSection(form, 'D. 활용 의향', '');
  form.addCheckboxItem()
    .setTitle('Q9. 오늘 배운 내용 중 가장 유용했던 주제를 모두 선택해 주세요.')
    .setChoiceValues([
      'AI 자동화 3단계',
      '자동화 대상 선정 기준',
      '자동화 실패 패턴',
      '좋은 프롬프트의 구조',
      'Claude Code 모범 사례',
      'AI 결과물 검증법',
      '실습 1 설문 자동 분석',
      '실습 2 채용공고 모니터링',
      'Q&A',
    ])
    .setRequired(true);
  addScale(form, 'Q10. 오늘 배운 내용을 실제 업무에 적용해 볼 의향이 있나요?');

  // ===== E. 개선 및 니즈 =====
  addSection(form, 'E. 개선 및 니즈', '선택 응답입니다. 짧게라도 적어 주시면 큰 도움이 됩니다.');
  form.addParagraphTextItem()
    .setTitle('Q11. 강의에서 개선이 필요한 점이나 아쉬웠던 점을 자유롭게 적어 주세요.')
    .setRequired(false);
  form.addParagraphTextItem()
    .setTitle('Q12. AI로 자동화해 보고 싶은 업무가 있다면 적어 주세요. (다음 강의 주제 참고용)')
    .setRequired(false);

  // ===== 응답 시트 연결 =====
  const ss = SpreadsheetApp.create(SHEET_NAME);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // ===== 검증 + 결과 출력 =====
  const questions = form.getItems().filter(function (it) {
    return /^Q\d+\./.test(it.getTitle());
  });
  if (questions.length !== 12) {
    Logger.log('⚠️ 문항 수가 12개가 아닙니다: ' + questions.length + '개');
  }

  Logger.log('✅ 설문 생성 완료 (문항 ' + questions.length + '개)');
  Logger.log('📝 응답 URL (수강생 배포용): ' + form.getPublishedUrl());
  Logger.log('🔧 편집 URL (강사용): ' + form.getEditUrl());
  Logger.log('📊 응답 시트 URL: ' + ss.getUrl());
}

// ----- 설정 -----
function applySettings(form) {
  // 이메일 수집 안 함 (새 API 우선, 없으면 이전 API)
  try {
    form.setEmailCollectionType(FormApp.EmailCollectionType.DO_NOT_COLLECT);
  } catch (e) {
    form.setCollectEmail(false);
  }
  form.setLimitOneResponsePerUser(false); // true면 Google 로그인이 필요해져 익명성이 깨짐
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  form.setProgressBar(true);
  form.setConfirmationMessage(CONFIRMATION_MESSAGE);
  form.setAcceptingResponses(true);

  // Workspace(회사·학교) 계정에서만 지원: 조직 외부 사용자도 응답 가능하게
  try { form.setRequireLogin(false); } catch (e) { /* 개인 계정은 해당 없음 */ }
  // 게시 설정을 지원하는 환경이면 바로 게시
  try { if (typeof form.setPublished === 'function') form.setPublished(true); } catch (e) {}
}

// ----- 도우미 -----
function addSection(form, title, helpText) {
  const page = form.addPageBreakItem().setTitle(title);
  if (helpText) page.setHelpText(helpText);
  return page;
}

function addChoice(form, title, choices) {
  return form.addMultipleChoiceItem()
    .setTitle(title)
    .setChoiceValues(choices)
    .setRequired(true);
}

function addScale(form, title) {
  return form.addScaleItem()
    .setTitle(title)
    .setBounds(1, 5)
    .setLabels(SCALE_LOW, SCALE_HIGH)
    .setRequired(true);
}
