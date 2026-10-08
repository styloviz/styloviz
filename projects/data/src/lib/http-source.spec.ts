import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { createQuery } from '@styloviz/core';
import { createHttpDataSource } from './http-source';
import { pageNumberQuery } from './query-presets';

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return {
    http: TestBed.inject(HttpClient),
    mock: TestBed.inject(HttpTestingController),
  };
}

describe('createHttpDataSource', () => {
  it('sends the mapped params through HttpClient', async () => {
    const { http, mock } = setup();
    const src = createHttpDataSource<{ id: string }>({
      url: '/api/orders',
      mapQuery: pageNumberQuery(),
      http,
    });

    const promise = src(createQuery({ page: 2, pageSize: 25 }), new AbortController().signal);
    const req = mock.expectOne((r) => r.url === '/api/orders');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('perPage')).toBe('25');

    req.flush({ items: [{ id: 'a' }], total: 1 });
    await expect(promise).resolves.toMatchObject({ items: [{ id: 'a' }], total: 1 });
    mock.verify();
  });

  it('normalizes an HttpErrorResponse into something renderable', async () => {
    const { http, mock } = setup();
    const src = createHttpDataSource({ url: '/api/x', http });
    const promise = src(createQuery(), new AbortController().signal);

    mock.expectOne('/api/x?offset=0&limit=10')
      .flush({ message: 'Nope' }, { status: 404, statusText: 'Not Found' });

    await expect(promise).rejects.toMatchObject({
      message: 'Nope',
      status: 404,
      // A 404 fails identically on retry — offering "Try again" would be a lie.
      retryable: false,
    });
  });

  it('actually cancels the request when the query is superseded', async () => {
    // Ignoring a superseded response is not enough: the request keeps running,
    // holds a connection, and on a slow link is what makes filtering feel laggy.
    const { http, mock } = setup();
    const ac = new AbortController();
    const src = createHttpDataSource({ url: '/api/x', http });
    const promise = src(createQuery(), ac.signal);

    const req = mock.expectOne('/api/x?offset=0&limit=10');
    expect(req.cancelled).toBe(false);

    ac.abort(new DOMException('superseded', 'AbortError'));
    await expect(promise).rejects.toBeInstanceOf(DOMException);
    expect(req.cancelled).toBe(true);
  });

  it('refuses immediately when handed an already-aborted signal', async () => {
    const { http, mock } = setup();
    const ac = new AbortController();
    ac.abort(new DOMException('gone', 'AbortError'));
    const src = createHttpDataSource({ url: '/api/x', http });
    await expect(src(createQuery(), ac.signal)).rejects.toBeInstanceOf(DOMException);
    mock.expectNone('/api/x');
  });
});
