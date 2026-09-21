import AppKit
import CoreImage
import Foundation
import Vision

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: generate-academy-foreground-mask.swift INPUT.png OUTPUT.png\n", stderr)
    exit(64)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])

guard
    let source = NSImage(contentsOf: inputURL),
    let cgImage = source.cgImage(forProposedRect: nil, context: nil, hints: nil)
else {
    fputs("Unable to decode input image.\n", stderr)
    exit(65)
}

let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up)

do {
    try handler.perform([request])
    guard let observation = request.results?.first else {
        fputs("Vision did not return a foreground mask.\n", stderr)
        exit(66)
    }

    print("Detected foreground instances: \(observation.allInstances.count)")

    let pixelBuffer = try observation.generateScaledMaskForImage(
        forInstances: observation.allInstances,
        from: handler
    )
    let mask = CIImage(cvPixelBuffer: pixelBuffer)
        .applyingFilter("CIMaskToAlpha")
    let context = CIContext(options: [.useSoftwareRenderer: false])
    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!

    try context.writePNGRepresentation(
        of: mask,
        to: outputURL,
        format: .RGBA8,
        colorSpace: colorSpace
    )
    print("Wrote \(outputURL.path)")
} catch {
    fputs("Foreground extraction failed: \(error)\n", stderr)
    exit(67)
}
