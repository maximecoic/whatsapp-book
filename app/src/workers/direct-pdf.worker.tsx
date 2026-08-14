/// <reference lib="webworker" />

import { pdf } from '@react-pdf/renderer'
import { DirectPdfDocument } from '../lib/direct-pdf'
import type {
  DirectPdfWorkerRequest,
  DirectPdfWorkerResponse,
} from '../lib/direct-pdf-export'

self.onmessage = (event: MessageEvent<DirectPdfWorkerRequest>) => {
  void pdf(
    <DirectPdfDocument {...event.data} />,
  ).toBlob().then(
    (blob) => {
      const response: DirectPdfWorkerResponse = { type: 'complete', blob }
      self.postMessage(response)
    },
    (error: unknown) => {
      const response: DirectPdfWorkerResponse = {
        type: 'error',
        message: error instanceof Error ? error.message : 'Le PDF n’a pas pu être rendu.',
      }
      self.postMessage(response)
    },
  )
}