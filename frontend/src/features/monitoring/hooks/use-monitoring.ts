/**
 * Re-export the canonical webcam monitoring hook. The single implementation
 * (camera capture + WebSocket/REST streaming) lives in shared/hooks.
 */
export {
  useMonitoring,
  type MonitoringStatus,
  type UseMonitoringOptions,
  type UseMonitoringResult,
} from "../../../shared/hooks/use-monitoring";
