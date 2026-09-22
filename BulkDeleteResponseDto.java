package com.nexusfiber.backend.controller.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class BulkDeleteResponseDto {
    private List<String> deletedIds;
    private int activeSkippedCount;
    private String message;
}
