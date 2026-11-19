/*
 * 전광판 설정 파일
 * ---------------------------------------------------------------
 * Firebase를 아직 연결하지 않았다면 그대로 두세요.
 * 그 상태에서는 "미리보기 모드"로 동작하고, 내용은 지금 보고 있는
 * 브라우저에만 저장됩니다(비밀번호 없이 편집 가능).
 *
 * Firebase 설정을 마치면 아래 두 곳을 채워 주세요.
 *  1) adminEmail : Firebase Authentication에 만든 관리자 계정 이메일
 *  2) firebase   : Firebase 콘솔 > 프로젝트 설정 > 내 앱 에서 복사한 값
 */
window.BOARD_CONFIG = {
  adminEmail: "",

  firebase: null
  /* 예시 (따옴표 안 값만 바꿔 넣으면 됩니다)
  firebase: {
    apiKey: "AIza...",
    authDomain: "my-gym-board.firebaseapp.com",
    projectId: "my-gym-board",
    storageBucket: "my-gym-board.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef"
  }
  */
};
