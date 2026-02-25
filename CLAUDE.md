# Claude Code 컨트롤 타워

## 프로젝트 개요
코딩 초보자가 Claude Code CLI를 GUI 대시보드로 제어하는 웹 앱.
프롬프트 가이드(.md)를 불러와서 스텝별 자동 실행 스크립트를 생성하고,
진행 상황을 실시간 대시보드에서 모니터링한다.

## 기술 스택
- Frontend: React 18 + Vite + Tailwind CSS
- Backend: Node.js 20 + Express + Socket.IO
- CLI 연동: child_process.spawn으로 claude CLI 호출
- 상태관리: 서버 메모리 (향후 SQLite 확장 가능)

## 아키텍처
[브라우저] ←WebSocket→ [Express 서버] ←child_process→ [claude CLI]

## 핵심 기능
1. 설정 마법사: 체크박스로 권한/MCP/플러그인 설정 → JSON 생성
2. 프롬프트 로더: .md 파일 파싱 → 스텝 리스트 생성
3. 대시보드: 스텝별 진행률 시각화
4. 자동 실행: 버튼 하나로 스텝 순차 실행 + 실시간 로그
5. 세션 관리: 세션 복구 명령어 모음

## 코드 규칙
- 한국어 주석, 에러 핸들링 필수
- ESM 모듈 (import/export)
- UI 텍스트 한국어
