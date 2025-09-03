using UnityEngine;
using UnityEditor;
using UnityEditor.Build.Reporting;
using System.IO;

/// <summary>
/// Unity Build Script for WebGL builds via command line
/// This script can be called from UnityGamificationUI auto-build functionality
/// </summary>
public class BuildScript
{
    /// <summary>
    /// Build WebGL from command line
    /// Usage: Unity -batchmode -quit -projectPath [ProjectPath] -executeMethod BuildScript.BuildWebGL
    /// </summary>
    [MenuItem("Build/Build WebGL")]
    public static void BuildWebGL()
    {
        string buildPath = "Builds/WebGL";
        
        // Ensure build directory exists
        if (!Directory.Exists(buildPath))
        {
            Directory.CreateDirectory(buildPath);
        }

        // Define build settings
        BuildPlayerOptions buildPlayerOptions = new BuildPlayerOptions();
        buildPlayerOptions.scenes = GetEnabledScenes();
        buildPlayerOptions.locationPathName = buildPath;
        buildPlayerOptions.target = BuildTarget.WebGL;
        buildPlayerOptions.options = BuildOptions.None;

        // Configure WebGL settings for optimal performance
        ConfigureWebGLSettings();

        Debug.Log("Starting WebGL build...");
        
        // Perform the build
        BuildReport report = BuildPipeline.BuildPlayer(buildPlayerOptions);
        BuildSummary summary = report.summary;

        if (summary.result == BuildResult.Succeeded)
        {
            Debug.Log($"Build succeeded: {summary.totalSize} bytes");
            Debug.Log($"Build location: {buildPath}");
            
            // Create index.html if it doesn't exist (for compatibility)
            CreateIndexHtmlIfNeeded(buildPath);
        }
        else if (summary.result == BuildResult.Failed)
        {
            Debug.LogError("Build failed");
            EditorApplication.Exit(1);
        }
        else
        {
            Debug.LogWarning($"Build completed with result: {summary.result}");
        }
    }

    /// <summary>
    /// Get all enabled scenes from build settings
    /// </summary>
    private static string[] GetEnabledScenes()
    {
        var scenes = new string[EditorBuildSettings.scenes.Length];
        for (int i = 0; i < EditorBuildSettings.scenes.Length; i++)
        {
            scenes[i] = EditorBuildSettings.scenes[i].path;
        }
        return scenes;
    }

    /// <summary>
    /// Configure WebGL settings for AlephScript integration
    /// </summary>
    private static void ConfigureWebGLSettings()
    {
        // Enable necessary WebGL features
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
        PlayerSettings.WebGL.memorySize = 512; // 512 MB memory
        PlayerSettings.WebGL.dataCaching = true;
        
        // Enable threading support if available
        #if UNITY_2021_2_OR_NEWER
        PlayerSettings.WebGL.threadsSupport = true;
        #endif
        
        // Optimization settings
        PlayerSettings.WebGL.template = "PROJECT:Minimal"; // Use minimal template
        
        Debug.Log("WebGL settings configured for AlephScript integration");
    }

    /// <summary>
    /// Create a compatible index.html if needed
    /// </summary>
    private static void CreateIndexHtmlIfNeeded(string buildPath)
    {
        string indexPath = Path.Combine(buildPath, "index.html");
        
        if (!File.Exists(indexPath))
        {
            // Look for Unity's generated HTML file
            string[] htmlFiles = Directory.GetFiles(buildPath, "*.html");
            
            if (htmlFiles.Length > 0)
            {
                // Copy the first HTML file as index.html
                File.Copy(htmlFiles[0], indexPath);
                Debug.Log($"Created index.html from {Path.GetFileName(htmlFiles[0])}");
            }
            else
            {
                Debug.LogWarning("No HTML file found in build output");
            }
        }
    }

    /// <summary>
    /// Build WebGL with custom settings for development
    /// </summary>
    [MenuItem("Build/Build WebGL (Development)")]
    public static void BuildWebGLDevelopment()
    {
        string buildPath = "Builds/WebGL-Dev";
        
        if (!Directory.Exists(buildPath))
        {
            Directory.CreateDirectory(buildPath);
        }

        BuildPlayerOptions buildPlayerOptions = new BuildPlayerOptions();
        buildPlayerOptions.scenes = GetEnabledScenes();
        buildPlayerOptions.locationPathName = buildPath;
        buildPlayerOptions.target = BuildTarget.WebGL;
        buildPlayerOptions.options = BuildOptions.Development | BuildOptions.AllowDebugging;

        ConfigureWebGLSettings();

        Debug.Log("Starting WebGL development build...");
        
        BuildReport report = BuildPipeline.BuildPlayer(buildPlayerOptions);
        BuildSummary summary = report.summary;

        if (summary.result == BuildResult.Succeeded)
        {
            Debug.Log($"Development build succeeded: {summary.totalSize} bytes");
            CreateIndexHtmlIfNeeded(buildPath);
        }
        else
        {
            Debug.LogError("Development build failed");
            EditorApplication.Exit(1);
        }
    }
}
