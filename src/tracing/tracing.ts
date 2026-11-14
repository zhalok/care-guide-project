/**
 * OpenTelemetry bootstrap. Must be the FIRST import in main.ts: the
 * instrumentations patch http, express and mongodb when those modules load.
 *
 * Standard OTEL_* environment variables apply, notably:
 *   OTEL_SDK_DISABLED=true            turn tracing off
 *   OTEL_SERVICE_NAME                 defaults to "care-guide-api"
 *   OTEL_EXPORTER_OTLP_ENDPOINT       defaults to http://localhost:4318
 */
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  ExpressInstrumentation,
  ExpressLayerType,
} from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { MongooseInstrumentation } from '@opentelemetry/instrumentation-mongoose';
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'care-guide-api',
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [
    new HttpInstrumentation({
      // Swagger UI assets are noise.
      ignoreIncomingRequestHook: (req) => (req.url ?? '').startsWith('/docs'),
    }),
    // Sets http.route (e.g. /notes/all) on the request span. Express's own
    // middleware layers (jsonParser, ...) are 0 ms noise, so they're skipped.
    new ExpressInstrumentation({
      ignoreLayersType: [ExpressLayerType.MIDDLEWARE, ExpressLayerType.ROUTER],
    }),
    new MongooseInstrumentation(),
    new MongoDBInstrumentation(),
  ],
});

sdk.start();

// Flush buffered spans before the process exits.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void sdk.shutdown().finally(() => process.kill(process.pid, signal));
  });
}
