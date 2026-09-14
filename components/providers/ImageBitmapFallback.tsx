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
          if (!(source instanceof Blob)) throw error
        }
      }

      if (source instanceof Blob) {
        return decodeWithImageElement(source) as any
      }

      throw new TypeError('This browser cannot process the selected photo format.')
    }

    const previous = window.createImageBitmap
    ;(window as typeof window & { createImageBitmap: typeof resilientCreateImageBitmap }).createImageBitmap = resilientCreateImageBitmap as any

    return () => {
      window.createImageBitmap = previous
    }
  }, [])

  return null
}
