# Apps Script / Sheet 적용 절차

## 현재 상태와 적용 범위

이 저장소에는 운영 Apps Script의 `doPost`, Sheet ID·시트 이름, Drive 폴더 ID,
메일 처리 원본이 없습니다. 공개 Web App URL로는 소스·Sheet 행을 조회할 수
없습니다. 따라서 이 모듈은 **미배포 추가 코드**이며 실제 저장 완료를 뜻하지
않습니다. 임의의 Sheet ID, 저장 순서, Drive·메일 구현을 만들지 않습니다.

`backend/apps-script/SubmissionExtras.gs`를 기존 Apps Script 프로젝트에 추가합니다.
기존 `doPost`를 교체하거나 별도 프로젝트/Web App을 만들지 않습니다.
프론트, endpoint, UI, 기존 폼 필드는 수정하지 않습니다.

## 1. 기존 처리 순서 먼저 확인

Apps Script 에디터에서 인재/기업 각각 다음 부분을 확인합니다.

1. 기존 검증·스팸 방어와 `e.parameter` 파싱
2. 이력서 비공개 Drive 저장 및 file ID/link 등 metadata 생성
3. 기존 Sheet 행 저장 (`appendRow` / `setValues` 등)
4. 동의 timestamp/version 저장
5. 신규 접수 알림메일
6. 최종 `{ok:true,id,message}` 응답

기존 원본/배포 버전을 보관합니다. 기존 시트·행·헤더를 이동/삭제하지 않습니다.
서버에 allowlist가 있으면 새 필드를 허용하되, 기존 검증/필드/동의 의미를 바꾸지
않습니다. 클라이언트의 동의 시각은 그대로 보존하고 별도 서버 접수 시각이 있다면
그것도 유지합니다. `resume_base64`는 Sheet에 추가 저장하지 않습니다.

## 2. 헤더와 저장 연결

헤더는 **1행**이라는 전제입니다. 다른 구조라면 원본을 확인해 헬퍼를 맞춘 뒤 적용합니다.
기존 헤더가 비어 있거나 중복·앞뒤 공백이 있으면 헬퍼는 중단합니다. 자동 수정하지 않습니다.

양쪽 Sheet의 기존 마지막 열 오른쪽에 없는 헤더만 다음 순서로 추가합니다.
수동으로 추가해도 되고 헬퍼의 최초 호출이 추가하도록 해도 됩니다.

| 순서 | 양쪽 Sheet 헤더 | 값 |
|---|---|---|
| 1 | `job_category` | 6개 공통 코드 / `other` / `legacy` / 빈 값 |
| 2 | `utm_source` | 전달된 원문 또는 빈 값 |
| 3 | `utm_medium` | 전달된 원문 또는 빈 값 |
| 4 | `utm_campaign` | 전달된 원문 또는 빈 값 |
| 5 | `job_category_legacy` | 과거 분류 원문 또는 빈 값 |
| 6 | `job_taxonomy_version` | 전달된 버전 또는 빈 값 |
| 7 | `job_category_raw` | payload의 job_category 원문, unknown 값 유실 방지 |

인재 Sheet에는 이어서 `nationality_code`, `residence_country_code`,
`visa_status_code`를 추가합니다. 이는 프론트 계약의 보조 코드이며 원문 필드를
대체하지 않습니다. 이미 존재하는 헤더 위치는 그대로 사용합니다. 기존 행의
새 열은 빈 상태로 두며 과거 행을 일괄 재분류하지 않습니다.

기존 상세 직무 `desired_role` / `hiring_role`, 동의, 이력서 metadata 열은 추가
모듈이 건드리지 않습니다. 반드시 기존 row 구성 코드에서 계속 저장해야 합니다.

기존 저장 코드가 `getLastColumn()`을 범위 폭으로 쓰면서 고정 길이 rowValues를
전달한다면, 새 열 추가 후 길이가 달라질 수 있습니다. 기존 기본 필드 저장 범위는
`rowValues.length`에 맞추고 값의 기존 순서는 유지합니다. 매 제출마다 고정 헤더로
1행 전체를 덮어쓰는 코드가 있다면 새 열을 지우지 않도록 기존 헤더 초기화 조건을
확인해야 합니다. 알림메일도 기존 row index/필드 이름을 유지합니다. 운영 원본이
없으므로 이 두 호환성 지점은 적용 담당자가 반드시 확인해야 합니다.

### 호출 지점 (실제 원본의 변수에 맞춰 적용)

아래는 **설명용 예시**입니다. 원본 변수 이름을 확인하지 않고 붙여넣지 않습니다.

```javascript
// 기존 모든 제출 처리에 쓰는 ScriptLock 안에서 수행합니다.
// 기존 검증/이력서 저장 코드는 그대로 유지합니다.
// 기존 rowValues의 필드 순서도 그대로 유지합니다.
sheet.appendRow(rowValues);                       // 기존 저장 코드
var savedRow = sheet.getLastRow();                 // 아직 lock을 해제하지 않은 상태
ktgWriteSubmissionExtras_(sheet, savedRow, e.parameter, 'talent', lock);
// 기업 처리에서는 type을 'company'로 전달합니다.
// 기존 알림메일 처리와 성공 응답은 위 저장 완료 이후에 그대로 실행합니다.
```

기존 저장 함수가 행 번호를 반환하면 `getLastRow()` 대신 그 번호를 사용합니다.
메일 내용에 개인정보나 신규 필드를 더 넣을 필요는 없습니다.

**동시성:** 기존 코드가 ScriptLock을 사용하면 같은 lock 범위 안에 행 저장,
행 번호 확보, 새 필드 쓰기를 모두 둡니다. 위 예시의 `lock`은 실제 기존 ScriptLock 객체입니다. 헬퍼는 그 객체의
`hasLock()`을 확인하며 자체 중첩 lock을 잡지 않습니다.
기존 lock이 없다면 해당 세 작업을 `LockService.getScriptLock()`의
`waitLock(30000)` / `try...finally { lock.releaseLock(); }`로 감싸고 모든 제출
분기에 동일하게 적용합니다. lock 없는 writer를 남기면 행 오배정 위험이 있습니다.

**실패 처리:** 헬퍼 실패를 무시하고 `{ok:true}`를 반환하지 않습니다. 기존의
일반 오류 응답을 사용하고 내부 오류/개인정보를 프론트에 노출하지 않습니다.
Sheet 쓰기와 Drive·메일은 하나의 트랜잭션이 아니므로, 실패 시 기존 행/파일이
이미 생성되었을 수 있습니다. 무조건 전체 제출을 재시도하면 중복이 생길 수
있습니다. 먼저 접수 ID/행을 확인하고, 필요하면 같은 `savedRow`에 헬퍼만
재실행합니다(멱등). 기존 중복 방지/접수 ID 처리가 있다면 유지합니다.

## 3. 배포

기존 배포의 **배포 관리 → 수정 → 새 버전**으로 갱신합니다. 기존 `/exec` URL은
유지합니다. 새 배포를 만들어 프론트 endpoint를 바꾸지 않습니다.
현재 실행 계정의 Sheet 쓰기, 비공개 Drive 저장, 메일 발송 권한을 유지합니다.
Drive `setSharing` 또는 public/anyone 링크 코드는 추가하지 않습니다.

## 4. 실제 테스트 순서 (운영 담당자 수행)

민감정보 없는 테스트 자료와 담당자가 관리하는 테스트 이메일을 사용합니다.
테스트 제출은 실제 행·Drive 파일·알림메일을 만듭니다.

1. KR Talent를 다음 query로 열고 다른 필수항목을 입력합니다.
   `?job_category=it_digital&utm_source=launch_qa&utm_medium=manual&utm_campaign=taxonomy_v1`
   세부 직무에는 `QA_ONLY — 백엔드 개발자`를 입력합니다.
2. 작은 PDF/DOC/DOCX 이력서 하나를 선택하고 개인정보 필수 동의를 체크합니다.
   선택 기회 검토 동의는 체크하지 않고 제출합니다.
3. 응답 `{ok:true,id,...}` 및 실제 인재 Sheet의 **같은 접수 ID 행**을 확인합니다.
   - `job_category=it_digital`, `desired_role` 원문, UTM 3개 일치
   - `privacy_consent_at` 및 `privacy_policy_version=privacy-v1.0-2026-10` 유지
   - 선택 동의 `no`, `opportunity_review_consent_at` 빈 값
   - 기존 resume 이름/type/file ID/link metadata와 비공개 Drive 파일 존재
   - 담당자 알림메일 정상 도착
4. EN Companies를 같은 UTM, `job_category=engineering_tech`로 열고
   `hiring_role=QA_ONLY — Electrical Engineer`와 필수 회사/담당자 정보를 입력해
   제출합니다. 기업 Sheet의 같은 접수 ID 행에서 분류·상세 직무·UTM·개인정보
   동의 timestamp/version 및 알림메일을 확인합니다.
5. 나머지 EN Talent / KR Companies도 언어별 저장 및 성공 메시지를 확인합니다.
   EN Talent에서는 선택 동의 yes → 시각 존재를 확인합니다.
6. 회귀: UTM 없는 제출의 UTM 열은 빈 값인지, 선택 이력서 없는 Talent도 되는지,
   필수값/이메일/5MB 초과·잘못된 확장자 차단, 한국 밖 거주 시 체류자격 처리,
   실패 시 입력 유지, 제출 중 중복 클릭 차단을 확인합니다.
7. 오래된 값은 운영 데이터 수정 없이 **별도 테스트 Sheet**에서 헬퍼에
   `job_category='IT·소프트웨어'`, `'기술 전문직'`, 임의 unknown 값을 전달합니다.
   각각 명확한 코드 매핑 / legacy + 원문 보존을 확인합니다.
8. 테스트 ID·시각·언어·검증 결과만 기록합니다. 로그에 이력서 base64나 입력
   개인정보를 출력하지 않습니다. 테스트 행/파일 정리는 운영자가 테스트 ID로
   식별하여 별도 수행하며, 기존 실제 데이터는 삭제하지 않습니다.

프론트 working tree가 아직 배포 전이라 운영 사이트에는 새 필드가 없을 수 있습니다.
실제 테스트는 해당 working tree를 로컬 서버로 실행해 진행하거나, 사용자 승인 후
프론트가 배포된 시점에 진행합니다. 이 작업에서는 commit/push하지 않습니다.

## 검증 범위

`node backend/tests/submission-extras.test.cjs`는 Apps Script/Sheet API test double로
기존 데이터·열 순서·동의·resume metadata 불변, 새 열 쓰기, 누락값, unknown/legacy,
멱등 및 문자열 formula 방어 API 사용을 검증합니다. 이는 실제 Google 권한,
Drive 비공개 상태, 메일 도착, `/exec` 배포 및 Sheet 저장 성공을 증명하지 않습니다.
