import 'reflect-metadata';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  InMemorySpanExporter,
  ReadableSpan,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { Traced } from './traced.decorator';

describe('Traced', () => {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
  });
  const contextManager = new AsyncLocalStorageContextManager();

  beforeAll(() => {
    context.setGlobalContextManager(contextManager.enable());
    trace.setGlobalTracerProvider(provider);
  });
  afterAll(async () => {
    await provider.shutdown();
    trace.disable();
    context.disable();
  });
  beforeEach(() => exporter.reset());

  const spans = () => exporter.getFinishedSpans();
  const byName = (name: string): ReadableSpan => {
    const span = spans().find((s) => s.name === name);
    if (!span) throw new Error(`no span named ${name}`);
    return span;
  };

  @Traced('repository')
  class Repo {
    async find(id: string): Promise<string> {
      return Promise.resolve(`row-${id}`);
    }
    async explode(): Promise<void> {
      await Promise.resolve();
      throw new Error('db down');
    }
  }

  @Traced('service')
  class Service {
    constructor(private readonly repo: Repo) {}
    async get(id: string) {
      return this.repo.find(id);
    }
    syncValue(n: number): number {
      return n * 2;
    }
    syncThrow(): never {
      throw new Error('sync boom');
    }
    whoAmI(): unknown {
      return this;
    }
  }

  @Traced('controller')
  class Controller {
    constructor(private readonly service: Service) {}
    async handle(id: string) {
      return this.service.get(id);
    }
  }

  it('wraps a method in a span named Class.method with layer attributes', async () => {
    await new Repo().find('1');

    const span = byName('Repo.find');
    expect(span.attributes).toMatchObject({
      'app.layer': 'repository',
      'code.namespace': 'Repo',
      'code.function': 'find',
    });
  });

  it('returns the original value and keeps async methods async', async () => {
    const result = new Repo().find('42');

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBe('row-42');
  });

  it('nests spans controller -> service -> repository', async () => {
    const controller = new Controller(new Service(new Repo()));

    await controller.handle('7');

    const c = byName('Controller.handle');
    const s = byName('Service.get');
    const r = byName('Repo.find');
    expect(s.parentSpanContext?.spanId).toBe(c.spanContext().spanId);
    expect(r.parentSpanContext?.spanId).toBe(s.spanContext().spanId);
    expect(new Set([c, s, r].map((x) => x.spanContext().traceId)).size).toBe(1);
    expect(c.attributes['app.layer']).toBe('controller');
    expect(s.attributes['app.layer']).toBe('service');
  });

  it('records the exception, marks the span as an error and rethrows (async)', async () => {
    await expect(new Repo().explode()).rejects.toThrow('db down');

    const span = byName('Repo.explode');
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.status.message).toBe('db down');
    expect(span.events.some((e) => e.name === 'exception')).toBe(true);
    expect(spans()).toHaveLength(1);
  });

  it('records errors thrown synchronously and rethrows them', () => {
    expect(() => new Service(new Repo()).syncThrow()).toThrow('sync boom');

    const span = byName('Service.syncThrow');
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
  });

  it('keeps synchronous methods synchronous', () => {
    const result = new Service(new Repo()).syncValue(21);

    expect(result).toBe(42);
    expect(byName('Service.syncValue')).toBeDefined();
  });

  it('ends a span only once, after the promise settles', async () => {
    await new Repo().find('1');

    expect(spans().filter((s) => s.name === 'Repo.find')).toHaveLength(1);
  });

  it('preserves `this`', () => {
    const service = new Service(new Repo());

    expect(service.whoAmI()).toBe(service);
  });

  it('does not create a span for the constructor', () => {
    new Service(new Repo());

    expect(spans()).toHaveLength(0);
  });

  it('does not record arguments or results', async () => {
    await new Repo().find('super-secret-argument');

    expect(JSON.stringify(spans().map((s) => s.attributes))).not.toContain(
      'super-secret-argument',
    );
  });

  it('copies metadata stored on the method function (routes, guards, docs)', () => {
    class Plain {
      route(): string {
        return 'ok';
      }
    }
    const methodOf = (cls: typeof Plain): object =>
      Object.getOwnPropertyDescriptor(cls.prototype, 'route')?.value as object;

    const original = methodOf(Plain);
    Reflect.defineMetadata('custom:key', 'custom-value', original);

    Traced('controller')(Plain);

    const wrapped = methodOf(Plain);
    expect(wrapped).not.toBe(original);
    expect(Reflect.getMetadata('custom:key', wrapped)).toBe('custom-value');
    expect((wrapped as { name: string }).name).toBe('route');
  });

  it('works without any tracer provider registered (no-op)', async () => {
    trace.disable();
    exporter.reset();

    await expect(new Repo().find('1')).resolves.toBe('row-1');
    expect(spans()).toHaveLength(0);

    trace.setGlobalTracerProvider(provider);
  });
});
