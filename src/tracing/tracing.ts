/**
 * OpenTelemetry bootstrap (traces + metrics). Must be the FIRST import in
 * main.ts: the instrumentations patch http, express and mongodb when those
 * modules load.
 *
 * Traces are pushed over OTLP; metrics (notably the HTTP request-duration
 * histogram) are exposed for Prometheus to scrape on a separate port, so they
 * are not part of the public API and need no auth.
 *
 * Standard OTEL_* environment variables apply, notably:
 *   OTEL_SDK_DISABLED=true            turn tracing and metrics off
 *   OTEL_SERVICE_NAME                 defaults to "care-guide-api"
 *   OTEL_EXPORTER_OTLP_ENDPOINT       traces; defaults to http://localhost:4318
 *   OTEL_EXPORTER_PROMETHEUS_PORT     metrics; defaults to 9464 (/metrics)
 *   OTEL_EXPORTER_PROMETHEUS_HOST     metrics; defaults to localhost
 */
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  ExpressInstrumentation,
  ExpressLayerType,
} from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MongooseInstrumentation } from '@opentelemetry/instrumentation-mongoose';
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'care-guide-api',
  traceExporter: new OTLPTraceExporter(),
  metricReaders: [
    new PrometheusExporter({
      // Listens on localhost only unless OTEL_EXPORTER_PROMETHEUS_HOST says
      // otherwise (docker compose sets 0.0.0.0 so Prometheus can reach it).
      host: process.env.OTEL_EXPORTER_PROMETHEUS_HOST,
      port: Number(process.env.OTEL_EXPORTER_PROMETHEUS_PORT) || undefined,
    }),
  ],
  instrumentations: [
    new HttpInstrumentation({
      // Swagger UI assets and Prometheus scrapes of /metrics are not API
      // traffic; counting them would skew the latency and rate dashboards.
      ignoreIncomingRequestHook: (req) =>
        /^\/(docs(-json)?|metrics)(\/|\?|$)/.test(req.url ?? ''),
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
