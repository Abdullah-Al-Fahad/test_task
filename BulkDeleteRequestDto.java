package com.nexusfiber.backend.controller.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import java.util.List;

@Data
public class BulkDeleteRequestDto {
    @NotEmpty(message = "A list of request IDs is required")
    private List<String> ids;
}
