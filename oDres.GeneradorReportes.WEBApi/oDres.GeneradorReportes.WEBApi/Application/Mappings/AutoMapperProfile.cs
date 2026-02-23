using AutoMapper;
using oDres.GeneradorReportes.WEBApi.Application.DTOs;
using oDres.GeneradorReportes.WEBApi.Domain.Entities;
using oDres.GeneradorReportes.WEBApi.Domain.Models;

namespace oDres.GeneradorReportes.WEBApi.Application.Mappings;

public class AutoMapperProfile : Profile
{
    public AutoMapperProfile()
    {
        CreateMap<Modulo, ModuleDto>()
            .ForMember(dest => dest.Nombre, opt => opt.MapFrom(src => src.Nombre ?? string.Empty))
            .ForMember(dest => dest.Administrador, opt => opt.MapFrom(src => src.Administrador ?? false))
            .ForMember(dest => dest.FechaRegistro, opt => opt.MapFrom(src => src.FechaRegistro ?? DateTime.MinValue))
            .ForMember(dest => dest.FechaActualizacion, opt => opt.MapFrom(src => src.FechaActualizacion ?? DateTime.MinValue))
            .ForMember(dest => dest.Usuario, opt => opt.MapFrom(src => src.Usuario ?? string.Empty))
            .ForMember(dest => dest.Programa, opt => opt.MapFrom(src => src.Programa ?? string.Empty))
            .ForMember(dest => dest.Activo, opt => opt.MapFrom(src => src.Activo ?? false))
            .ReverseMap();
        
        CreateMap<Reporte, ReportDto>()
            .ForMember(dest => dest.Nombre, opt => opt.MapFrom(src => src.Nombre ?? string.Empty))
            .ForMember(dest => dest.Titulo, opt => opt.MapFrom(src => src.Titulo ?? string.Empty))
            .ForMember(dest => dest.SentenciaSQL, opt => opt.MapFrom(src => src.SentenciaSQL ?? string.Empty))
            .ForMember(dest => dest.ModuloNombre, opt => opt.MapFrom(src => src.Modulo != null ? src.Modulo.Nombre ?? string.Empty : string.Empty))
            .ReverseMap();

        CreateMap<ReportParameter, ReportParameterDto>()
            .ForMember(dest => dest.DataType, opt => opt.MapFrom(src => src.DataType.Name))
            .ReverseMap()
            .ForMember(dest => dest.DataType, opt => opt.MapFrom(src => GetTypeFromString(src.DataType)));

        CreateMap<ReportResult, ReportResultDto>().ReverseMap();
    }

    private static Type GetTypeFromString(string typeName)
    {
        return typeName.ToLower() switch
        {
            "datetime" => typeof(DateTime),
            "int32" or "int" => typeof(int),
            "decimal" => typeof(decimal),
            "boolean" or "bool" => typeof(bool),
            "guid" or "uuid" or "uniqueidentifier" => typeof(Guid),
            _ => typeof(string)
        };
    }
}
