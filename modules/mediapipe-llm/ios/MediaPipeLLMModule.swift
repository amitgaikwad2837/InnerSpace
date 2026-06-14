import ExpoModulesCore
#if canImport(MediaPipeTasksGenai)
import MediaPipeTasksGenai
#endif

public final class MediaPipeLLMModule: Module {
  private var configuredModelId: String = "gemma2b_mediapipe"
  private var modelPath: String = ""
#if canImport(MediaPipeTasksGenai)
  private var llmInference: LlmInference?
#endif

  public func definition() -> ModuleDefinition {
    Name("MediaPipeLLM")

    Function("isAvailable") { () -> Bool in
#if canImport(MediaPipeTasksGenai)
      true
#else
      false
#endif
    }

    Function("configureModel") { (modelId: String, configuredPath: String?) -> Void in
      self.configuredModelId = modelId
      if let configuredPath, !configuredPath.isEmpty {
        self.modelPath = configuredPath
      }
#if canImport(MediaPipeTasksGenai)
      self.llmInference = nil
#endif
    }

    Function("setModelPath") { (configuredPath: String) -> Void in
      self.modelPath = configuredPath
#if canImport(MediaPipeTasksGenai)
      self.llmInference = nil
#endif
    }

    Function("getModelPath") { () -> String in
      self.modelPath
    }

    Function("isModelReady") { () -> Bool in
      guard !self.modelPath.isEmpty else { return false }
      return FileManager.default.fileExists(atPath: self.modelPath)
    }

    Function("getConfiguredModelId") { () -> String in
      self.configuredModelId
    }

    AsyncFunction("generate") { (messagesJson: String, temperature: Double?, maxTokens: Int?) -> String in
#if canImport(MediaPipeTasksGenai)
      guard !self.modelPath.isEmpty, FileManager.default.fileExists(atPath: self.modelPath) else {
        throw NSError(domain: "MediaPipeLLM", code: 1, userInfo: [NSLocalizedDescriptionKey: "Model file not found at path: \(self.modelPath)"])
      }

      let userPrompt = Self.extractLastUserMessage(messagesJson: messagesJson)
      let inference = try self.getOrCreateInference(temperature: temperature, maxTokens: maxTokens)
      return try inference.generateResponse(inputText: userPrompt)
#else
      let userPrompt = Self.extractLastUserMessage(messagesJson: messagesJson)
      let temp = temperature ?? 0.2
      let max = maxTokens ?? 512
      return "[MediaPipe unavailable] Model=\(self.configuredModelId) temp=\(temp) maxTokens=\(max). Add MediaPipeTasksGenAI pods. Last user message: \(userPrompt)"
#endif
    }
  }

#if canImport(MediaPipeTasksGenai)
  private func getOrCreateInference(temperature: Double?, maxTokens: Int?) throws -> LlmInference {
    if let llmInference {
      return llmInference
    }

    let options = LlmInferenceOptions()
    options.baseOptions.modelPath = modelPath
    options.maxTokens = maxTokens ?? 512
    options.topk = 40
    options.temperature = Float(temperature ?? 0.2)
    options.randomSeed = 101

    let created = try LlmInference(options: options)
    self.llmInference = created
    return created
  }
#endif

  private static func extractLastUserMessage(messagesJson: String) -> String {
    guard
      let data = messagesJson.data(using: .utf8),
      let list = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else {
      return ""
    }

    for item in list.reversed() {
      guard let role = item["role"] as? String, role == "user" else { continue }
      return item["content"] as? String ?? ""
    }
    return ""
  }
}
