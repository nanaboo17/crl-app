'use client'

import { useEffect } from 'react'

const MAX_IMAGE_DIMENSION = 1600

function scaledSize(width: number, height: number) {
  const longest = Math.max(width, height)
  if (!width || !height || longest <= MAX_IMAGE_DIMENSION) return { width, height }

  const scale = MAX_IMAGE_DIMENSION / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function reportPhotoProcessingError(error: unknown, source?: ImageBitmapSource) {
  if (typeof window === 'undefined') return
  const message = error instanceof Error ? error.message : String(error)
  const blob = source instanceof Blob ? source : null

  window.dispatchEvent(new CustomEvent('crl-photo-processing-error', {
    detail: {
      message,
      file_type: blob?.type || null,
      file_size_bytes: blob?.size || null,
      max_dimension: MAX_IMAGE_DIMENSION,
    },
  }))
}

export default function ImageBitmapFallback() {
  useEffect(() => {
    const nativeCreateImageBitmap = window.createImageBitmap?.bind(window)

    const renderToSafeCanvas = (
      source: CanvasImageSource,
      sourceWidth: number,
      sourceHeight: number
    ) => {
      const size = scaledSize(sourceWidth, sourceHeight)
      const canvas = document.createElement('canvas') as HTMLCanvasElement & { close?: () => void }
      canvas.width = size.width
      canvas.height = size.height

      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx || !canvas.width || !canvas.height) {
        throw new TypeError('The selected photo could not be processed by this browser.')
      }

      ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
      canvas.close = () => {
        canvas.width = 1
        canvas.height = 1
      }
      return canvas
    }

    const decodeWithImageElement = async (blob: Blob) => {
      const objectUrl = URL.createObjectURL(blob)

      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.decoding = 'async'
          img.onload = () => resolve(img)
          img.onerror = () => reject(new TypeError('The selected photo could not be decoded by this browser.'))
          img.src = objectUrl
        })

        return renderToSafeCanvas(
          image,
          image.naturalWidth || image.width,
          image.naturalHeight || image.height
        )
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }

    const resilientCreateImageBitmap = async (source: ImageBitmapSource, options?: ImageBitmapOptions) => {
      let nativeError: unknown = null

      if (nativeCreateImageBitmap) {
        try {
          const bitmap = await nativeCreateImageBitmap(source, options)
          try {
            // Camera photos can be 12–50 MP. The visit form previously created a
            // second full-resolution canvas for the GPS/timestamp stamp, which can
            // exceed the memory available to lower-end Android/iOS browsers.
            // Normalize the decoded image to a field-safe size before the form
            // creates its stamping canvas.
            if (Math.max(bitmap.width, bitmap.height) > MAX_IMAGE_DIMENSION) {
              return renderToSafeCanvas(bitmap, bitmap.width, bitmap.height) as any
            }
            return bitmap
          } finally {
            if (Math.max(bitmap.width, bitmap.height) > MAX_IMAGE_DIMENSION) bitmap.close()
          }
        } catch (error) {
          nativeError = error
          if (!(source instanceof Blob)) {
            reportPhotoProcessingError(error, source)
            throw error
          }
        }
      }

      if (source instanceof Blob) {
        try {
          return await decodeWithImageElement(source) as any
        } catch (fallbackError) {
          reportPhotoProcessingError(fallbackError || nativeError, source)
          throw fallbackError
        }
      }

      const error = new TypeError('This browser cannot process the selected photo format.')
      reportPhotoProcessingError(error, source)
      throw error
    }

    const previous = window.createImageBitmap
    ;(window as typeof window & { createImageBitmap: typeof resilientCreateImageBitmap }).createImageBitmap = resilientCreateImageBitmap as any

    return () => {
      window.createImageBitmap = previous
    }
  }, [])

  return null
}
