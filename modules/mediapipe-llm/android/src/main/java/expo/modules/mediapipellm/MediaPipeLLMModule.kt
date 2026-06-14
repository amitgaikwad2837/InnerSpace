package expo.modules.mediapipellm

import java.io.File
import org.json.JSONArray
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MediaPipeLLMModule : Module() {
  private var configuredModelId: String = "gemma2b_mediapipe"
  private var modelPath: String = "/data/local/tmp/llm/gemma2b.task"
  private var llmInference: LlmInference? = null

  override fun definition() = ModuleDefinition {
    Name("MediaPipeLLM")

    Function("isAvailable") {
      return@Function true
    }

    Function("configureModel") { modelId: String, configuredPath: String? ->
      configuredModelId = modelId
      if (!configuredPath.isNullOrBlank()) {
        modelPath = configuredPath
      }
      llmInference?.close()
      llmInference = null
    }

    Function("setModelPath") { configuredPath: String ->
      modelPath = configuredPath
      llmInference?.close()
      llmInference = null
    }

    Function("getModelPath") {
      return@Function modelPath
    }

    Function("isModelReady") {
      return@Function File(modelPath).exists()
    }

    Function("getConfiguredModelId") {
      return@Function configuredModelId
    }

    AsyncFunction("generate") { messagesJson: String, temperature: Double?, maxTokens: Int? ->
      if (!File(modelPath).exists()) {
        throw IllegalStateException("Model file not found at path: $modelPath")
      }

      val inference = getOrCreateInference(temperature, maxTokens)
      val userPrompt = extractLastUserMessage(messagesJson)
      return@AsyncFunction inference.generateResponse(userPrompt)
    }
  }

  private fun getOrCreateInference(temperature: Double?, maxTokens: Int?): LlmInference {
    llmInference?.let { return it }
    val context = requireNotNull(appContext.reactContext)

    val builder = LlmInference.LlmInferenceOptions.builder()
      .setModelPath(modelPath)
      .setMaxTokens(maxTokens ?: 512)
      .setTemperature((temperature ?: 0.2).toFloat())
      .setTopK(40)
      .setRandomSeed(101)

    val options = builder.build()
    val created = LlmInference.createFromOptions(context, options)
    llmInference = created
    return created
  }

  private fun extractLastUserMessage(messagesJson: String): String {
    return try {
      val arr = JSONArray(messagesJson)
      for (i in arr.length() - 1 downTo 0) {
        val item = arr.optJSONObject(i) ?: continue
        if (item.optString("role") == "user") {
          return item.optString("content", "")
        }
      }
      ""
    } catch (_: Throwable) {
      ""
    }
  }
}
