using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

// Get base path from configuration (e.g., "/test-generator")
var basePath = builder.Configuration["BasePath"] ?? "";

// Start Node.js process
var nodeProcess = StartNodeJsApp();

// Handle root redirect to base path
if (!string.IsNullOrEmpty(basePath))
{
    app.MapGet("/", () => Results.Redirect(basePath));
}

// Use reverse proxy to forward requests to Node.js - MUST be after routing
app.MapReverseProxy();

// Graceful shutdown
var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
lifetime.ApplicationStopping.Register(() =>
{
    try
    {
        if (!nodeProcess.HasExited)
        {
            nodeProcess.Kill();
            nodeProcess.WaitForExit(5000);
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error stopping Node.js process: {ex.Message}");
    }
});

app.Run();

static Process StartNodeJsApp()
{
    var startInfo = new ProcessStartInfo
    {
        FileName = "node",
        Arguments = "server.js",
        WorkingDirectory = Directory.GetCurrentDirectory(),
        UseShellExecute = false,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        CreateNoWindow = true,
        Environment = 
        {
            ["PORT"] = "3000" // Node.js runs on 3000, .NET proxy runs on configured port
        }
    };

    // Add any environment variables from appsettings
    var configuration = new ConfigurationBuilder()
        .SetBasePath(Directory.GetCurrentDirectory())
        .AddJsonFile("appsettings.json", optional: true)
        .AddEnvironmentVariables()
        .Build();

    if (!string.IsNullOrEmpty(configuration["OPENAI_API_KEY"]))
    {
        startInfo.Environment["OPENAI_API_KEY"] = configuration["OPENAI_API_KEY"];
    }

    if (!string.IsNullOrEmpty(configuration["OPENAI_MODEL"]))
    {
        startInfo.Environment["OPENAI_MODEL"] = configuration["OPENAI_MODEL"];
    }

    var process = Process.Start(startInfo);
    
    if (process == null)
        throw new InvalidOperationException("Failed to start Node.js process");

    // Log Node.js output for debugging
    process.OutputDataReceived += (sender, e) =>
    {
        if (!string.IsNullOrEmpty(e.Data))
            Console.WriteLine($"Node.js: {e.Data}");
    };
    
    process.ErrorDataReceived += (sender, e) =>
    {
        if (!string.IsNullOrEmpty(e.Data))
            Console.WriteLine($"Node.js Error: {e.Data}");
    };

    process.BeginOutputReadLine();
    process.BeginErrorReadLine();

    // Give Node.js a moment to start
    Thread.Sleep(2000);

    return process;
}
