import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { createQuery } from '@styloviz/core/data';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SV_DATA_LABELS } from './data.labels';
import { createHttpDataSource } from './http-source';

afterEach(() => TestBed.resetTestingModule());

describe('@styloviz/data — labels (FL-B1e)', () => {
  it('raises the unreadable-response message in the language an app provides', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSvLabels({ data: { unreadableResponse: 'Die Antwort konnte nicht gelesen werden.' } }),
      ],
    });
    const src = TestBed.runInInjectionContext(() =>
      createHttpDataSource({
        url: '/api/x',
        mapResponse: () => {
          throw new Error('');
        },
      }),
    );
    const promise = src(createQuery(), new AbortController().signal);
    TestBed.inject(HttpTestingController).expectOne('/api/x?offset=0&limit=10').flush({});

    await expect(promise).rejects.toMatchObject({ message: 'Die Antwort konnte nicht gelesen werden.' });
  });

  it('keeps the English default', () => {
    expect(SV_DATA_LABELS.unreadableResponse).toBe('Could not read the response.');
  });
});
