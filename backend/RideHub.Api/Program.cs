using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            // For development, allow any origin. For production, specify the frontend URL.
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        });
});

// Define the path to the service account key
string credentialPath = "firebase-key.json";

// Initialize Firebase Admin SDK
// Check to avoid "App already exists" error during reload
if (FirebaseApp.DefaultInstance == null)
{
    FirebaseApp.Create(new AppOptions()
    {
        Credential = GoogleCredential
            .FromFile(credentialPath)
            .CreateScoped("https://www.googleapis.com/auth/cloud-platform")
    });
}

// Configure Firestore
builder.Services.AddSingleton(provider =>
{
    Environment.SetEnvironmentVariable(
        "GOOGLE_APPLICATION_CREDENTIALS",
        Path.Combine(builder.Environment.ContentRootPath, "firebase-key.json"));

    return FirestoreDb.Create("ridehub-4ab73");
});

builder.Services.AddSingleton<RideHub.Api.Services.FirestoreService>();
builder.Services.AddSingleton<RideHub.Api.Services.EmailService>();
// Add services to the container.
builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter 'Bearer {your token}'"
    });

    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

// Configure Authentication
builder.Services.AddAuthentication(Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://securetoken.google.com/ridehub-4ab73";
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = "https://securetoken.google.com/ridehub-4ab73",
            ValidateAudience = true,
            ValidAudience = "ridehub-4ab73",
            ValidateLifetime = true
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Enable CORS
app.UseCors("AllowFrontend");

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(Path.Combine(app.Environment.ContentRootPath, "..", "..", "frontend")),
    RequestPath = ""
});

app.UseExceptionHandler("/error");

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/error", () => Results.Problem());
app.MapGet("/", () => "RideHub API Running");

app.MapControllers();


app.Run();
