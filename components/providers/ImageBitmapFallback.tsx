'use client'

import { useEffect } from 'react'

export default function ImageBitmapFallback() {
  useEffect(() => {
    const nativeCreateImageBitmap = window.createImageBitmap?.bind(window)

    const decodeWithImageElement = async (blob: Blob) => {
      const objectUrl = URL.createObjectURL(blob)

      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => reject(new TypeError('The selected photo could not be decoded by this browser.'))
          img.src = objectUrl
        })

        const canvas = document.createElement('canvas') as HTMLCanvasElement & { close?: () => void }
        canvas.width = image.naturalWidth || image.width
        canvas.height = image.naturalHeight || image.height

        const ctx = canvas.getContext('2d')
        if (!ctx || !canvas.width || !canvas.height) {
          throw new TypeError('The selected photo could not be processed by this browser.')
        }

        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        canvas.close = () => undefined

        return canvas
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }

    const resilientCreateImageBitmap = async (source: ImageBitmapSource, options?: ImageBitmapOptions) => {
      if (nativeCreateImageBitmap) {
        try {
          return await nativeCreateImageBitmap(source, options)
        } catch (error) {
          if (!(source instanceof Blob)) throw error
        }
      }

      if (source instanceof Blob) {
        return decodeWithImageElement(source)
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
