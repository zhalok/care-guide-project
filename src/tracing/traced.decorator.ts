import 'reflect-metadata';
import { Span, SpanStatusCode, trace } from '@opentelemetry/api';

export type Layer = 'controller' | 'service' | 'repository';

const TRACER_NAME = 'care-guide-api';

type AnyFn = (...args: unknown[]) => unknown;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function fail(span: Span, error: unknown): void {
  span.recordException(error instanceof Error ? error : String(error));
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error instanceof Error ? error.message : String(error),
  });
  span.end();
}

/**
 * Class decorator: every method of the class runs inside an OpenTelemetry span
 * named `ClassName.method`, tagged with the architectural layer. Spans nest
 * (controller -> service -> repository) through the active context.
 *
 * Only names are recorded, never arguments or results, so no request data
 * (tokens, passwords, note content) ends up in traces.
 *
 * The tracer is resolved per call, so this is a no-op until a tracer provider
 * is registered (see tracing.ts) and is free in unit tests.
 */
export function Traced(layer: Layer): ClassDecorator {
  return (target) => {
    const proto = target.prototype as Record<string, unknown>;

    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const descriptor = Object.getOwnPropertyDescriptor(proto, name);
      if (!descriptor || typeof descriptor.value !== 'function') continue;

      const original = descriptor.value as AnyFn;
      const spanName = `${target.name}.${name}`;

      const traced = function (this: unknown, ...args: unknown[]): unknown {
        return trace.getTracer(TRACER_NAME).startActiveSpan(
          spanName,
          {
            attributes: {
              'app.layer': layer,
              'code.namespace': target.name,
              'code.function': name,
            },
          },
          (span) => {
            try {
              const result = original.apply(this, args);
              if (isPromiseLike(result)) {
                return result.then(
                  (value) => {
                    span.end();
                    return value;
                  },
                  (error: unknown) => {
                    fail(span, error);
                    throw error;
                  },
                );
              }
              span.end();
              return result;
            } catch (error) {
              fail(span, error);
              throw error;
            }
          },
        );
      };

      // Nest, Swagger and the RBAC guard store route/guard/doc metadata on the
      // method function itself, so the wrapper must carry it over.
      for (const key of Reflect.getMetadataKeys(original)) {
        Reflect.defineMetadata(key, Reflect.getMetadata(key, original), traced);
      }
      Object.defineProperty(traced, 'name', { value: name });

      Object.defineProperty(proto, name, { ...descriptor, value: traced });
    }
  };
}
