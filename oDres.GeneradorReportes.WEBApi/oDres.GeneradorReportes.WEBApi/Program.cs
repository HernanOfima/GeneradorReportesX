using Microsoft.EntityFrameworkCore;
using oDres.GeneradorReportes.WEBApi.Infrastructure.Data;
using oDres.GeneradorReportes.WEBApi.Domain.Interfaces;
using oDres.GeneradorReportes.WEBApi.Infrastructure.Repositories;
using oDres.GeneradorReportes.WEBApi.Application.Mappings;
using oDres.GeneradorReportes.WEBApi.Infrastructure.Services;
using FluentValidation;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Database
builder.Services.AddDbContext<ReportDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Repositories
builder.Services.AddScoped<IModuleRepository, ModuleRepository>();
builder.Services.AddScoped<IReportRepository, ReportRepository>();

// Services
builder.Services.AddScoped<ExcelExportService>();

// MediatR
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));

// AutoMapper
builder.Services.AddAutoMapper(typeof(AutoMapperProfile));

// FluentValidation
builder.Services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() 
    { 
        Title = "Sistema Generador de Reportes API", 
        Version = "v1",
        Description = "API para la generación y ejecución de reportes dinámicos con análisis inteligente de parámetros SQL",
        Contact = new() { Name = "oDres", Email = "admin@odres.com" }
    });
    
    // Incluir comentarios XML si existen
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }
    
    // Configurar esquemas de ejemplo
    c.EnableAnnotations();
});

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseSwagger();
app.UseSwaggerUI(c => 
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Sistema Generador de Reportes API v1");
    c.RoutePrefix = string.Empty; // Hace que Swagger sea la página principal
    c.DocumentTitle = "oDres - Generador de Reportes API";
    c.DefaultModelsExpandDepth(-1); // Ocultar modelos por defecto
    c.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.None);
});

app.UseHttpsRedirection();

app.UseCors("AllowAngular");

app.UseAuthorization();

app.MapControllers();

app.Run();
