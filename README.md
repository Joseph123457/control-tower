# Control Tower

> Claude Code CLI를 GUI 대시보드로 제어하는 웹 애플리케이션

![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![React](https://img.shields.io/badge/React-18-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 소개

Control Tower는 코딩 초보자도 쉽게 Claude Code CLI를 사용할 수 있도록 도와주는 웹 대시보드입니다.

### 주요 기능

- **설정 마법사**: 5단계 마법사로 `settings.json`, `CLAUDE.md` 등 설정 파일 자동 생성
- **프롬프트 파싱**: 마크다운 가이드 파일을 단계별 실행 스크립트로 변환
- **실시간 대시보드**: 진행률 추적, 상태 모니터링, 실시간 로그 확인
- **자동 실행**: 버튼 하나로 모든 스텝 순차 실행
- **세션 관리**: 세션 복구 및 대화 내보내기 지원

## 스크린샷

### 설정 마법사
프로젝트 정보, 권한 설정, MCP 서버, 플러그인을 단계별로 구성합니다.

### 프롬프트 탭
마크다운 파일을 드래그 앤 드롭으로 업로드하고 스텝을 추출합니다.

### 대시보드
진행률 통계, Phase별 스텝 목록, 실시간 로그를 한눈에 확인합니다.

## 설치 방법

### 요구사항

- Node.js 20 이상
- npm 또는 yarn
- Claude Code CLI (선택사항, 실행 기능 사용 시 필요)

### 1. 저장소 클론

```bash
git clone https://github.com/your-username/control-tower.git
cd control-tower
```

### 2. 의존성 설치

```bash
# 전체 설치 (루트 + backend + frontend)
npm run install:all

# 또는 개별 설치
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 3. Claude Code CLI 설치 (선택사항)

```bash
npm install -g @anthropic-ai/claude-code
```

## 실행 방법

### 개발 모드

프론트엔드(5173)와 백엔드(3001)를 동시에 실행합니다.

```bash
npm run dev
```

브라우저에서 http://localhost:5173 접속

### 프로덕션 모드

```bash
# 프론트엔드 빌드
npm run build

# 서버 시작 (Windows)
npm run start

# 서버 시작 (Linux/Mac)
npm run start:unix
```

프로덕션 모드에서는 백엔드가 프론트엔드 정적 파일을 서빙합니다.
http://localhost:3001 접속

## 사용법

### 1. 설정 마법사 (Wizard)

1. **프로젝트 정보**: 이름, 설명, 타입 입력
2. **권한 설정**: 허용할 명령어와 차단 패턴 선택
3. **MCP 서버**: GitHub, Filesystem 등 MCP 서버 선택
4. **플러그인**: Superpowers, Code Review 등 플러그인 선택
5. **완료**: 생성된 설정 파일 확인 및 다운로드

### 2. 프롬프트 탭

1. 마크다운 파일(.md)을 드래그 앤 드롭하거나 직접 붙여넣기
2. "스텝 파싱하기" 클릭
3. 추출된 스텝 목록 확인
4. "대시보드에서 실행하기" 클릭

**지원 형식:**
```markdown
## 🔷 Phase 1: 프로젝트 초기화

### 프롬프트 1-1: 환경 설정

프롬프트 내용...

```bash
실행할 코드
```

### 1-2. 다른 형식도 지원

...
```

### 3. 대시보드 탭

- **통계 카드**: 진행률, 완료, 진행중, 대기, 실패 개수
- **프로그레스 바**: 전체 진행률 시각화
- **스텝 목록**: Phase별로 그룹화된 스텝
  - 클릭하여 프롬프트 내용 확인
  - 복사 버튼으로 프롬프트 복사
  - 상태 토글로 완료 표시
  - 개별 실행 버튼
- **실시간 로그**: 터미널 스타일 로그 패널

### 4. 실행 탭

- **전체 실행**: 모든 스텝 순차 실행
- **자동 실행 스크립트**: bash 스크립트 생성 및 복사
- **자주 쓰는 명령어**: Claude CLI 명령어 모음
- **실시간 로그**: stdout/stderr 실시간 출력

### 5. 세션 탭

- **자동 저장 안내**: 세션 저장 위치 및 형식
- **세션 복구 명령어**: `--continue`, `--resume` 등
- **CLAUDE.md 규칙**: 세션 관리 규칙 코드블록
- **대화 추출 도구**: claude-conversation-extractor 사용법

## 프로젝트 구조

```
control-tower/
├── package.json          # 루트 package.json (concurrently)
├── README.md
├── CLAUDE.md             # Claude Code 설정
│
├── backend/              # Express + Socket.IO 백엔드
│   ├── package.json
│   └── src/
│       ├── index.js      # 메인 서버
│       ├── routes/       # API 라우트
│       ├── services/     # 비즈니스 로직
│       │   ├── promptParser.js
│       │   ├── configGenerator.js
│       │   └── cliRunner.js
│       └── utils/        # 유틸리티
│
└── frontend/             # React + Vite 프론트엔드
    ├── package.json
    └── src/
        ├── App.jsx       # 메인 앱
        ├── components/   # UI 컴포넌트
        │   ├── Layout.jsx
        │   ├── WizardTab.jsx
        │   ├── PromptsTab.jsx
        │   ├── DashboardTab.jsx
        │   ├── RunnerTab.jsx
        │   └── SessionsTab.jsx
        └── lib/          # 유틸리티
            ├── constants.js
            └── promptParser.js
```

## API 엔드포인트

### Health Check
```
GET /api/health
```

### 설정 생성
```
POST /api/config/generate
Body: { projectName, allowedCommands, ... }
```

### 프롬프트 파싱
```
POST /api/prompts/parse
Body: { content: "markdown content" }
```

### 실행 제어
```
POST /api/runner/start   # 전체 실행 시작
POST /api/runner/stop    # 실행 중지
GET  /api/runner/status  # 상태 조회
```

## Socket.IO 이벤트

### 클라이언트 → 서버
- `run-all`: 전체 스텝 실행
- `run-step`: 개별 스텝 실행
- `stop`: 실행 중지

### 서버 → 클라이언트
- `status`: 서버 상태
- `step-start`: 스텝 시작
- `step-output`: 실시간 출력
- `step-complete`: 스텝 완료
- `step-error`: 스텝 에러
- `run-complete`: 전체 완료
- `run-stopped`: 실행 중지됨

## 에러 처리

### Claude CLI 미설치
- 헤더에 경고 배너 표시
- 실행 버튼 비활성화
- 설치 명령어 안내

### 서버 연결 실패
- 자동 재연결 (최대 10회)
- 재연결 버튼 제공
- 에러 메시지 표시

### 프롬프트 파싱 실패
- 지원 형식 가이드 표시
- 에러 위치 안내
- 예시 템플릿 제공

## 테스트

```bash
# 백엔드 테스트 (73개)
cd backend && npm test

# 프론트엔드 빌드 테스트
cd frontend && npm run build
```

## 기술 스택

### Frontend
- React 18
- Vite 5
- Tailwind CSS
- Socket.IO Client
- Lucide React (아이콘)

### Backend
- Node.js 20
- Express 4
- Socket.IO 4
- child_process (CLI 실행)

## 라이선스

MIT License

## 기여

버그 리포트나 기능 제안은 GitHub Issues를 이용해주세요.

## 참고 링크

- [Claude Code 공식 문서](https://docs.anthropic.com/claude-code)
- [Anthropic API](https://docs.anthropic.com/api)
