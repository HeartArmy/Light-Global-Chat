import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'globalchat',
  });
}

// OpenTelemetry configuration for Kubiks
// The @vercel/otel package will automatically use these environment variables:
// - OTEL_EXPORTER_OTLP_ENDPOINT: https://ingest.kubiks.app
// - OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
// - OTEL_EXPORTER_OTLP_HEADERS: x-kubiks-key=YOUR_API_KEY
// - OTEL_SERVICE_NAME: globalchat
//
// Make sure these are set in your .env.local or deployment environment variables