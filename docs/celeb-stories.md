# 셀럽스토리 운영

홈의 바이럴 베스트 바로 아래에 셀럽 프로필, 팔로워 수, Instagram 프로필 바로가기를 표시합니다. 원형 프로필을 가로로 배치하고 모든 프로필에 무지개 테두리를 표시합니다. 이 테두리는 장식이며 실제 스토리 게시 여부를 나타내지 않습니다. 게시물 피드와 스토리 상태는 조회하지 않습니다.

## 실제 연동 설정

2026-09-26에 `Powerpuff Celeb Story` 앱의 사용자 토큰에서 `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list` 승인과 실제 Business Discovery 조회를 확인했습니다. 관리 페이지의 `instagram_business_account`를 직접 조회해 운영 계정 ID를 확인했고, 비밀값을 Git에서 제외되는 `.env.local`에 저장해 로컬 서버에 연결했습니다. `me/accounts`는 빈 목록을 반환했지만 페이지 직접 조회와 셀럽 조회는 정상 작동했습니다.

수영·채령·예지는 실제 팔로워 수와 프로필 사진이 반환됩니다. 한소희(`xeesoxee`)·윈터(`imwinter`)는 현재 Meta에서 `Invalid user id`(110)를 반환합니다. 이 응답만으로 정확한 원인을 단정하지 않으며, 해당 프로필의 숫자는 `???`로 표시하고 Instagram 링크는 유지합니다. 현재 토큰은 단기 사용자 토큰입니다. **장기 운영용 토큰 확장과 Netlify 환경변수 등록·운영 배포는 아직 완료되지 않았습니다.**

1. Meta for Developers 등록을 마칩니다. 약관 동의와 본인 확인은 계정 소유자의 확인이 필요합니다.
2. Instagram API with Facebook Login 앱과 Facebook 페이지에 연결된 운영용 Instagram 프로페셔널 계정을 준비합니다.
3. Business Discovery에 필요한 Facebook 사용자 액세스 토큰 권한은 `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`입니다. 페이지 목록 조회에는 `pages_show_list`가 필요할 수 있습니다. 비즈니스 관리자를 통해 페이지 역할을 받은 경우 추가 권한 요구 사항을 아래 공식 문서에서 확인합니다. 앱 접근 수준에 따라 앱 검수가 필요합니다.
4. Netlify 함수 환경변수에 `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`(운영 계정의 Instagram 사용자 ID), `INSTAGRAM_GRAPH_VERSION=v26.0`을 등록하고 배포합니다. 토큰을 소스·브라우저·공개 저장소에 넣지 않습니다. 앱 ID와 Instagram 사용자 ID는 다릅니다.
5. `/.netlify/functions/celeb-stories?username=sooyoungchoi` 응답에서 `state: ready`, `followers`, `fetchedAt`을 확인합니다. 팔로워 수가 반환되지 않으면 `null`로 유지하며 0으로 표시하지 않습니다.

로컬에서는 같은 값을 `.env.local`에 지정하고 `npm run dev`를 실행합니다. Vite의 개발 서버 전용 미들웨어가 같은 Netlify 함수를 실행합니다. 토큰 변경 후 서버를 재시작합니다.

## 셀럽 계정

기본 대상은 기존 운영 상품의 프로필 출처에서 확인한 수영(`sooyoungchoi`), 한소희(`xeesoxee`), 채령(`chaerrry0`), 윈터(`imwinter`), 예지(`yezyizhere`)입니다. 계정별 실제 조회 결과는 위 연결 상태를 참고합니다.

관리자 상품 편집 화면의 **셀럽스토리 관리**에서 이름과 인스타 아이디 또는 프로필 주소를 등록하고 **변경 적용**을 누릅니다. 순서 변경·삭제를 지원하며, 상단의 **서버 저장됨** 상태로 저장 완료를 확인합니다. 목록은 기존 콘텐츠 저장소와 공개 요약에 함께 보관됩니다. 이름은 기존 셀럽 카테고리와 맞추면 기존 사진을 대체 이미지로 쓸 수 있습니다. 전체 삭제 시 콘텐츠를 숨깁니다.

관리자 목록이 아직 저장되지 않았다면 `INSTAGRAM_CELEB_ACCOUNTS`의 아래 JSON 배열이 서버 기본 목록을 대체합니다. `name`은 사이트의 셀럽 카테고리 이름과 일치해야 합니다. 중복·잘못된 사용자명·30개를 넘는 목록은 거부합니다.

```json
[
  { "name": "수영", "username": "sooyoungchoi" },
  { "name": "한소희", "username": "xeesoxee" }
]
```

등록된 계정만 서버에서 조회할 수 있습니다. 미연결·조회 실패 상태에서는 팔로워 수를 `???`로 표시합니다. 확인된 사용자명의 Instagram 프로필 바로가기는 인증 전에도 작동합니다.

## 갱신과 장애

- 브라우저는 보이는 동안 1분마다 확인하고, 서버/CDN은 계정별 15분 캐시를 사용합니다. 즉시 푸시 방식이 아니며 API 반환 지연이 있을 수 있습니다.
- `username`, `profile_picture_url`, `followers_count`만 요청합니다. 게시물·스토리를 수집하지 않습니다.
- 통신 실패와 502/503/504 응답은 한 번 재시도합니다. 잘못된 계정·인증 실패는 반복 호출하지 않습니다. 브라우저는 갱신 중 숫자를 비우지 않고 최근 성공 수치를 최대 1시간 유지하며, 지난 수치는 점과 툴팁으로 구분합니다.
- 장애 시 같은 실행 인스턴스에 남아 있는 마지막 성공 데이터를 최대 1시간 동안 `stale`로 표시합니다. 서버 재시작까지 유지되는 영구 캐시는 아닙니다. 이후 빈 상태로 전환하고 재시도할 수 있습니다.
- 토큰 만료·권한 철회 시 조회가 중단됩니다. Meta 도구에서 권한·유효기간을 점검하고 갱신한 토큰으로 서버 환경변수를 교체합니다.
- 공개 응답에 토큰·API 원본 오류·개인 메시지·비공개 게시물을 포함하지 않습니다.

## 검증

`npm run check`에서 120개 테스트·린트·빌드를 통과했습니다. `tests/celeb-stories-api.test.ts`는 미설정, 정상 응답, 인증 실패, 계정 불일치, 게시물 미요청, 캐시·동시 요청·장애 복구를 검증합니다. 실제 토큰을 연결한 로컬 함수에서 등록된 5개 계정의 응답도 확인했습니다.

## 반응형 화면

- 왼쪽 위에 **인스타라이브** 제목을 표시하고, 무지개 원형 사진 → 셀럽 이름 → 팔로워 수 순으로 구성합니다. 설명 문구는 표시하지 않습니다. 제목과 테두리는 실제 방송·스토리 게시 여부를 의미하지 않습니다.
- 팔로워 수는 `95만`, `737.8만`처럼 한글 단위로 표시하며 숫자를 굵게, 단위를 작게 강조합니다. PC는 균등한 그리드와 큰 프로필·구분선을, 모바일은 낮은 높이의 가로 스크롤을 사용합니다. 인접 콘텐츠와의 외부 간격은 8px입니다.
- 모바일 셀럽 랭킹은 찾기 버튼 위 왕관 버튼으로 엽니다. 배경 딤드, 포커스 제한, 닫기 버튼을 갖춘 투표 창에서 기존 투표 API와 상태를 공유합니다. PC는 본문 랭킹을 유지합니다.

공식 사양(2026-09-26 확인): [Business Discovery](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-discovery), [권한 및 참조](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery).

- 섹션이 화면에 35% 이상 들어오면 첫 진입에만 프로필이 순차적으로 떠오르고 무지개 링에 빛이 한 번 지나갑니다. 모션 줄이기 설정에서는 애니메이션을 생략하며, 감지 기능이 없어도 콘텐츠는 그대로 표시됩니다.
