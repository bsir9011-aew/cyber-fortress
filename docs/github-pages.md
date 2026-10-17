# Publikacja FORTRESS LAB przez GitHub Pages

Docelowy adres: https://bsir9011-aew.github.io/cyber-fortress/.
Sprint 7 zachowuje istniejący workflow. Nie wykonujemy merge PR ani wdrożenia
nowej wersji przed zatwierdzeniem. 17.10.2026 API potwierdziło Pages w trybie
`workflow` i status `success` deploymentu scalonego Sprintu 6 (`main` 173d135).
Nowy build Sprintu 7 zweryfikowano lokalnie pod właściwą podścieżką; nie jest
jeszcze publicznym wdrożeniem.

## Konfiguracja publikacji (Pages jest już włączone)

1. W repozytorium otwórz **Settings → Pages → Build and deployment → GitHub Actions**.
2. Sprawdź środowisko **Settings → Environments → github-pages**. Dopuść deployment
   z `main`; możesz dodatkowo ustawić wymagany przegląd wdrożenia.
3. Zatwierdź i scal PR Sprintu 6 własną decyzją. Push do `main` uruchomi workflow
   **GitHub Pages**. Jeśli Pages włączono po nieudanym przebiegu, uruchom ponownie
   workflow albo wybierz **Run workflow** z gałęzią `main`.
4. Zaczekaj na powodzenie jobów **Test, types and build** oraz **Deploy production**.
   Potwierdź deployment w środowisku `github-pages` i otwórz opublikowany adres.
5. Sprawdź w prawdziwej witrynie start, akcję, odświeżenie i wznowienie. Dev i
   publiczna domena mają różne localStorage; użyj eksportu/importu do transferu.

Nie są potrzebne klucze API, tokeny użytkownika, backend ani gałąź `gh-pages`.
Workflow używa wbudowanego `GITHUB_TOKEN` i OIDC. Nie włączamy Pages automatycznie
przez token o podwyższonych uprawnieniach.

## Workflow i ścieżki

`.github/workflows/ci.yml` sprawdza Pull Request, bez uprawnień publikacji.
`.github/workflows/pages.yml` reaguje wyłącznie na push do `main` lub ręczne
uruchomienie. Oba joby Pages mają `if: github.ref == 'refs/heads/main'`, więc
ręczny wybór innej gałęzi także nie publikuje. Build wykonuje `npm ci`, typecheck,
wszystkie testy i `npm run build`. Dopiero potem konfiguruje Pages i przesyła
wyłącznie `dist/` jako artifact. Job deploy wymaga powodzenia builda i używa
oficjalnego mechanizmu `deploy-pages` w środowisku `github-pages`.

Globalne uprawnienie to `contents: read`; build dodatkowo odczytuje metadane przez `pages: read`. Tylko job wdrożenia ma `pages: write`
i `id-token: write`. Concurrency `github-pages`, bez przerywania aktywnego
wdrożenia, serializuje publikacje. Artifact ma retencję 1 dzień i nie obejmuje
źródeł, dokumentacji, prototypu, cache, testów ani node_modules.

Sprawdzono 16.10.2026 zainstalowany Vite **8.3.4** i aktualne wydania oficjalnych
Actions przez GitHub API. Użyte wersje przypięto do pełnego SHA commita:

| Action                        | Wersja |
| ----------------------------- | ------ |
| actions/checkout              | v7.0.1 |
| actions/setup-node            | v7.1.0 |
| actions/configure-pages       | v6.0.0 |
| actions/upload-pages-artifact | v5.0.0 |
| actions/deploy-pages          | v5.0.1 |

`vite.config.ts` ustawia bazę `/cyber-fortress/` podczas builda i preview.
`npm run dev` zachowuje bazę `/`. Zasoby importowane w JS/CSS są przetwarzane
przez Vite; przyszłe publiczne zasoby należy adresować przez
`import.meta.env.BASE_URL`, zamiast bezwzględnej ścieżki `/assets/...`.
Nie używamy routingu wymagającego przepisywania adresów na serwerze.

## Co potwierdzono

Lokalny produkcyjny preview pod podścieżką: HTML, CSS i JavaScript działają,
Chromium wykonuje pełne misje, zapis i import, bez błędnych żądań zasobów.
Publikacja Sprintu 7 pozostaje do potwierdzenia po zatwierdzeniu i merge.
Historycznie podczas przygotowania Sprintu 6 Pages było wyłączone; obecnie API
potwierdza udany deployment Sprintu 6. Bezpośredni GET publicznej domeny z tego
środowiska zakończył się odmową HTTP 403, dlatego nie deklarujemy osobistej
weryfikacji publicznego UI. Preview produkcyjne jest zweryfikowane w Chromium.

Źródła mechanizmu: [Vite — GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages),
[oficjalne deploy-pages](https://github.com/actions/deploy-pages),
[configure-pages](https://github.com/actions/configure-pages),
[upload-pages-artifact](https://github.com/actions/upload-pages-artifact).
